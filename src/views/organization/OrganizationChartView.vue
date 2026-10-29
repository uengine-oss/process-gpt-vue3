<template>
    <v-card elevation="10" class="rounded-xl sk-page-card org-page">
        <!-- ───────────── 페이지 헤더 ───────────── -->
        <div class="page-header">
            <div class="page-header-left">
                <h1 class="page-title">{{ $t('OrganizationChartView.title') }}</h1>
                <p class="page-subtitle">{{ $t('OrganizationChartView.subtitle', { teams: teamCount, members: assignedCount, unassigned: unassignedUsers.length }) }}</p>
            </div>
            <div class="page-header-right">
                <div class="org-status">
                    <template v-if="!editable">
                        <v-icon size="14">mdi-eye-outline</v-icon>
                        <span>{{ canManageRoles ? $t('OrganizationChartView.rolesOnly') : $t('OrganizationChartView.readOnly') }}</span>
                    </template>
                    <template v-else-if="saving">
                        <v-progress-circular indeterminate size="12" width="2" />
                        <span>{{ $t('OrganizationChartView.saving') }}</span>
                    </template>
                    <template v-else-if="saveError">
                        <v-icon size="14" color="error">mdi-alert-circle-outline</v-icon>
                        <span class="text-error">{{ $t('OrganizationChartView.saveFailed') }}</span>
                    </template>
                    <template v-else-if="lastSavedLabel">
                        <v-icon size="14" color="success">mdi-check-circle-outline</v-icon>
                        <span>{{ lastSavedLabel }}</span>
                    </template>
                </div>
            </div>
        </div>

        <v-tabs v-if="canManageRoles" v-model="activeTab" color="primary" class="org-tabs" height="48">
            <v-tab id="organization-tab" value="organization" class="text-none" aria-controls="organization-panel">{{ $t('OrganizationChartView.title') }}</v-tab>
            <v-tab id="approvals-tab" value="approvals" class="text-none" aria-controls="approvals-panel">
                {{ $t('OrganizationChartView.approvalsTab') }}
                <v-chip v-if="membershipRequests.counts.total" size="x-small" color="primary" class="ml-2">
                    {{ membershipRequests.counts.total }}
                </v-chip>
            </v-tab>
        </v-tabs>

        <section id="organization-panel" v-show="activeTab === 'organization'" class="org-chart-tab" role="tabpanel" :aria-label="$t('OrganizationChartView.title')">
            <!-- ───────────── 툴바 ───────────── -->
            <header class="org-toolbar">
                <div class="org-toolbar__search">
                    <v-text-field
                        v-model="searchQuery"
                        :placeholder="$t('OrganizationChartView.searchPlaceholder')"
                        variant="solo-filled"
                        flat
                        density="compact"
                        hide-details
                        rounded="pill"
                        prepend-inner-icon="mdi-magnify"
                        clearable
                    />
                    <span v-if="searchQuery && matchedIds.size" class="org-toolbar__hits">{{ $t('OrganizationChartView.hits', { n: matchedIds.size }) }}</span>
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
                        {{ $t('OrganizationChartView.addTeam') }}
                    </v-btn>

                    <v-btn
                        v-if="canManageRoles"
                        size="small"
                        variant="tonal"
                        class="text-none"
                        prepend-icon="mdi-account-clock-outline"
                        @click="openPreRegister"
                    >
                        {{ $t('OrganizationChartView.preRegister') }}
                    </v-btn>

                    <v-divider vertical class="mx-1" />

                    <v-btn icon size="small" variant="text" :title="$t('OrganizationChartView.expandAll')" @click="expandAll">
                        <v-icon size="19">mdi-arrow-expand-vertical</v-icon>
                    </v-btn>
                    <v-btn icon size="small" variant="text" :title="$t('OrganizationChartView.collapseAll')" @click="collapseAll">
                        <v-icon size="19">mdi-arrow-collapse-vertical</v-icon>
                    </v-btn>
                    <v-btn
                        icon
                        size="small"
                        variant="text"
                        :title="showMembers ? $t('OrganizationChartView.hideMembers') : $t('OrganizationChartView.showMembers')"
                        :color="showMembers ? 'primary' : undefined"
                        @click="showMembers = !showMembers"
                    >
                        <v-icon size="19">mdi-account-multiple-outline</v-icon>
                    </v-btn>

                    <v-divider vertical class="mx-1" />

                    <v-btn icon size="small" variant="text" :title="$t('OrganizationChartView.zoomOut')" @click="zoomBy(-0.1)">
                        <v-icon size="19">mdi-magnify-minus-outline</v-icon>
                    </v-btn>
                    <button class="org-zoom" :title="$t('OrganizationChartView.resetZoom')" @click="zoom = 1">{{ Math.round(zoom * 100) }}%</button>
                    <v-btn icon size="small" variant="text" :title="$t('OrganizationChartView.zoomIn')" @click="zoomBy(0.1)">
                        <v-icon size="19">mdi-magnify-plus-outline</v-icon>
                    </v-btn>
                    <v-btn icon size="small" variant="text" :title="$t('OrganizationChartView.fitToScreen')" @click="fitToScreen">
                        <v-icon size="19">mdi-fit-to-screen-outline</v-icon>
                    </v-btn>

                    <v-divider vertical class="mx-1" />

                    <v-btn
                        icon
                        size="small"
                        variant="text"
                        :title="panelOpen ? $t('OrganizationChartView.closePanel') : $t('OrganizationChartView.openPanel')"
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
                            <p>{{ $t('OrganizationChartView.loading') }}</p>
                        </div>

                        <div v-else-if="!hasTeams" class="org-canvas__state">
                            <v-icon size="42" color="primary">mdi-sitemap-outline</v-icon>
                            <p>{{ $t('OrganizationChartView.noTeams') }}</p>
                            <v-btn
                                v-if="editable"
                                color="primary"
                                variant="flat"
                                class="text-none"
                                prepend-icon="mdi-plus"
                                @click="openAddTeam(root)"
                            >
                                {{ $t('OrganizationChartView.createFirstTeam') }}
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
                            <span>{{ $t('OrganizationChartView.unassignedCount', { n: unassignedUsers.length }) }}</span>
                            <v-icon size="16">{{ unassignedOpen ? 'mdi-chevron-down' : 'mdi-chevron-up' }}</v-icon>
                        </button>
                        <div v-if="unassignedOpen" class="org-unassigned__list">
                            <div
                                v-for="user in unassignedUsers"
                                :key="user.id"
                                class="org-unassigned__chip"
                                :draggable="editable"
                                :title="editable ? $t('OrganizationChartView.dragToAssign') : user.email"
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
        </section>

        <section
            v-if="canManageRoles && activeTab === 'approvals'"
            id="approvals-panel"
            class="org-approvals-tab"
            role="tabpanel"
            aria-labelledby="approvals-tab"
        >
            <MembershipApprovalPanel @reviewed="onMembershipReviewed" />
        </section>

        <!-- ───────────── 부서 추가 ───────────── -->
        <v-dialog v-model="addTeamDialog" max-width="420">
            <v-card class="pa-4">
                <v-card-title class="pa-0 pb-1 text-h6">{{ $t('OrganizationChartView.addTeam') }}</v-card-title>
                <p class="org-dialog__hint">{{ $t('OrganizationChartView.addTeamHint', { parent: addTeamParentLabel }) }}</p>
                <v-card-text class="pa-0 pt-3">
                    <v-text-field
                        v-model="newTeamName"
                        :label="$t('OrganizationChartView.teamName')"
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
                    <v-btn variant="text" class="text-none" @click="addTeamDialog = false">{{ $t('OrganizationChartView.cancel') }}</v-btn>
                    <v-btn
                        color="primary"
                        variant="flat"
                        class="text-none"
                        :disabled="!newTeamName.trim() || !!addTeamError"
                        @click="commitAddTeam"
                    >
                        {{ $t('OrganizationChartView.add') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="preRegisterDialog" max-width="460">
            <v-card class="pa-4">
                <v-card-title class="pa-0 pb-1 text-h6">{{ $t('OrganizationChartView.preRegister') }}</v-card-title>
                <p class="org-dialog__hint">{{ $t('OrganizationChartView.preRegisterHint') }}</p>
                <v-card-text class="pa-0 pt-3 d-flex flex-column ga-3">
                    <v-text-field
                        v-model="preRegister.email"
                        :label="$t('OrganizationChartView.email')"
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
                        :label="$t('OrganizationChartView.team')"
                        variant="outlined"
                        density="compact"
                        hide-details
                    />
                    <v-select
                        v-model="preRegister.role"
                        :items="preRegisterRoleItems"
                        item-title="title"
                        item-value="value"
                        :label="$t('OrganizationChartView.role')"
                        variant="outlined"
                        density="compact"
                        hide-details
                    />
                </v-card-text>
                <v-card-actions class="pa-0 pt-4">
                    <v-spacer />
                    <v-btn variant="text" class="text-none" @click="preRegisterDialog = false">{{ $t('OrganizationChartView.cancel') }}</v-btn>
                    <v-btn
                        color="primary"
                        variant="flat"
                        class="text-none"
                        :loading="preRegisterSaving"
                        :disabled="!validPreRegister"
                        @click="commitPreRegister"
                        >{{ $t('OrganizationChartView.register') }}</v-btn
                    >
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- ───────────── 부서 삭제 ───────────── -->
        <v-dialog v-model="removeTeamDialog" max-width="440">
            <v-card class="pa-4">
                <v-card-title class="pa-0 pb-1 text-h6">{{ $t('OrganizationChartView.deleteTeam') }}</v-card-title>
                <v-card-text class="pa-0 pt-3">
                    <p class="mb-2">
                        <strong>{{ removeTeamTarget ? nodeName(removeTeamTarget) : '' }}</strong> {{ $t('OrganizationChartView.deleteTeamConfirm') }}
                    </p>
                    <p class="org-dialog__hint">
                        {{
                            $t('OrganizationChartView.deleteTeamHint', {
                                teams: $tc('OrganizationChartView.subTeamCount', removeTeamStats.teams, { n: removeTeamStats.teams }),
                                members: $tc('OrganizationChartView.placementCount', removeTeamStats.members, { n: removeTeamStats.members })
                            })
                        }}
                    </p>
                </v-card-text>
                <v-card-actions class="pa-0 pt-4">
                    <v-spacer />
                    <v-btn variant="text" class="text-none" @click="removeTeamDialog = false">{{ $t('OrganizationChartView.cancel') }}</v-btn>
                    <v-btn color="error" variant="flat" class="text-none" @click="commitRemoveTeam">{{ $t('OrganizationChartView.delete') }}</v-btn>
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
import { useRoute } from 'vue-router';
import BackendFactory from '@/components/api/BackendFactory';
import { writeActivityLog } from '@/services/activityAuditLog';
import AgentBadgesDiagram from '@/components/ui/AgentBadgesDiagram.vue';
import AgentCreateDialog from '@/components/ui/AgentCreateDialog.vue';
import OrganizationEditDialog from '@/components/ui/OrganizationEditDialog.vue';
import OrgDetailPanel from './OrgDetailPanel.vue';
import OrgTreeNode from './OrgTreeNode.vue';
import MembershipApprovalPanel from './MembershipApprovalPanel.vue';
import { useMembershipRequestsStore } from '@/stores/membershipRequests';
import { getResolvedRole, getIsAdminClaim } from '@/utils/authClaims';
import { hasRoleAtLeast, isAdminRole, ROLE_HIERARCHY, ROLE_META } from '@/utils/roles';
import { isMaskedEmail } from '@/utils/piiMasking';
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
const membershipRequests = useMembershipRequestsStore();
const route = useRoute();
const activeTab = ref('organization');
const instance = getCurrentInstance();
const eventBus = instance?.appContext.config.globalProperties.EventBus;
const t = (key, params) => instance?.proxy?.$t(key, params) ?? key;
const tc = (key, count, params) => instance?.proxy?.$tc(key, count, params) ?? key;

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
const currentRole = computed(() => getResolvedRole());
const isAdminFlag = computed(() => getIsAdminClaim());

/** 조직 구조(부서·배치) 편집 — owner 이상 */
const editable = computed(() => isAdminRole(currentRole.value) || hasRoleAtLeast(currentRole.value, 'owner') || isAdminFlag.value);
/** 사용자 역할 변경 — admin 이상 (ManageAccessTab 과 동일 기준) */
const canManageRoles = computed(() => isAdminRole(currentRole.value) || hasRoleAtLeast(currentRole.value, 'admin') || isAdminFlag.value);

watch(
    [() => route.query.approvals, canManageRoles],
    ([approvals, canManage]) => {
        activeTab.value = canManage && approvals === '1' ? 'approvals' : 'organization';
    },
    { immediate: true }
);

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
    return isDuplicateTeamName(root.value, name) ? t('OrganizationChartView.duplicateTeamName') : '';
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
    return t('OrganizationChartView.savedAt', { time: `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}` });
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

/**
 * 조직도 사용자 목록.
 *
 * 읽기 전용 사용자(viewer/editor/reviewer)에게는 마스킹 뷰 `users_masked` 를
 * 준다 — 조직도는 전 직원 이메일이 한 화면에 늘어서는 자리다.
 *
 * 편집 권한이 있는 사용자(owner 이상)에게는 원본 `users` 를 준다. 배치할 때
 * `createMemberNode()` 가 이메일을 조직도 JSON 에 복사해 저장하고,
 * `organizationUtils` 가 그 값으로 권한·공개범위를 매칭하기 때문이다.
 * 마스킹된 값이 저장되면 그 사람이 조용히 팀에서 빠진다.
 * (DB 뷰의 원본 노출 기준은 admin 이라 owner 는 뷰에서도 마스킹된다 —
 *  그래서 역할이 아니라 편집 권한으로 조회 대상을 가른다.)
 * 그래도 마스킹 값이 섞여 들어올 수 있어 memberNodeFor() 가 한 번 더 막는다.
 */
async function loadUsers() {
    try {
        const fetchUsers = editable.value ? backend.getUserList : backend.getMaskedUserList;
        const list = await fetchUsers.call(backend, {
            orderBy: 'username',
            sort: 'asc',
            match: { tenant_id: window.$tenantName }
        });
        registeredUsers.value = (list || []).filter((user) => user && user.id && user.is_draft !== true && (!user.membership_status || user.membership_status === 'approved'));
    } catch (error) {
        console.error('[OrganizationChart] 사용자 목록 로드 실패:', error);
        registeredUsers.value = [];
    }
    mergeUsers();
}

async function onMembershipReviewed() {
    await loadUsers();
    const byId = new Map(users.value.map(user => [user.id, user]));
    walk(root.value, node => {
        const user = byId.get(node.id);
        if (user && node.data) node.data.role = user.role;
    });
}

function mergeUsers() {
    users.value = [...registeredUsers.value, ...pendingMembers.value];
}

async function loadPendingMembers() {
    try {
        // 사전등록 인원은 이메일이 곧 표시 이름이다(아직 계정이 없어 username 이 없다).
        // 사전등록 자체는 admin(canManageRoles) 만 하고, admin 은 마스킹 뷰에서도
        // 원본을 받으므로 조회는 항상 마스킹 뷰로 보낸다.
        const { data, error } = await window.$supabase
            .from(window.$pal ? 'pending_org_members_masked' : 'pending_org_members')
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
    rememberStoredEmails();
    expandAll();
}

/* ── 조직도 JSON 의 이메일 보존 ──────────────────────
 *
 * 조직도 노드는 이메일을 복사해서 들고 있고, organizationUtils 가 그 값으로
 * "이 사람이 이 팀 소속인가" 를 판정한다(공개범위·권한). 마스킹된 값이 저장되면
 * 그 사람이 조용히 팀에서 빠지므로, 마스킹 값은 절대 쓰지 않고 조직도에
 * 이미 있던 원본을 되살려 쓴다.
 */
const storedEmailById = new Map();

function rememberStoredEmails() {
    walk(root.value, (node) => {
        const email = node.data?.email;
        if (email && !isMaskedEmail(email)) storedEmailById.set(node.id, email);
    });
}

/** createMemberNode 래퍼 — 마스킹된 이메일이 조직도에 저장되지 않게 한다. */
function memberNodeFor(user, parentId) {
    const node = createMemberNode(user, parentId);
    if (!isMaskedEmail(node.data.email)) {
        if (node.data.email) storedEmailById.set(node.id, node.data.email);
        return node;
    }
    const known = storedEmailById.get(node.id);
    // 원본을 모르면 마스킹 값을 남기느니 비워 둔다. 잘못된 값으로 매칭되는 것이
    // 값이 없는 것보다 나쁘다(다른 사람으로 오인될 수 있다).
    node.data.email = known || undefined;
    return node;
}

/* ── 활동 로그 ──────────────────────────────────────── */

// 세부 액션 로그(org_team_create 등)가 이번 저장 사이클을 이미 설명했으면
// persist 의 일반(org_chart_update) 로그를 건너뛰어 같은 변경이 두 번 적재되는 것을 막는다.
let saveCoveredByActionLog = false;

/**
 * 조직도 활동 로그 기록. PAL 전용·실패 무시(writeActivityLog 관례).
 * coversSave=true(기본)면 뒤따르는 debounce 저장의 일반 로그를 억제한다.
 */
function logOrgActivity(entry, coversSave = true) {
    if (coversSave) saveCoveredByActionLog = true;
    writeActivityLog({ target_type: 'organization', ...entry });
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
        // 세부 액션 로그가 없는 변경(부서 드래그 이동·리더 지정·에이전트 수정·사전등록 등)만 일반 로그로 남긴다
        if (!saveCoveredByActionLog) {
            writeActivityLog({ action: 'org_chart_update', target_type: 'organization', target_name: '조직도' });
        }
        return true;
    } catch (error) {
        console.error('[OrganizationChart] 저장 실패:', error);
        saveError.value = true;
        toast(t('OrganizationChartView.chartSaveFailed'), 'error');
        return false;
    } finally {
        saving.value = false;
        saveCoveredByActionLog = false;
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
        // 조직도 JSON 의 이메일은 마스킹 뷰를 거치지 않는다. 검색 대상에 그대로
        // 두면 화면에 안 보이는 주소를 질의로 맞혀 볼 수 있으므로, 원본 목록을
        // 받는(편집 권한 있는) 사용자에게만 검색 대상에 넣는다.
        const storedEmail = editable.value ? node.data?.email : null;
        const haystack = [displayName(node), storedEmail, user?.username, user?.email, node.data?.description]
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
        toast(t('OrganizationChartView.teamMovedUnder', { target: displayName(targetTeam) }));
        return;
    }

    if (payload.kind === 'member') {
        if (payload.fromTeamId === targetTeam.id) return;
        if (payload.fromTeamId) removeMemberFromTeam(root.value, payload.fromTeamId, payload.id);
        const user = users.value.find((candidate) => candidate.id === payload.id);
        if (!user) return;
        attachNode(root.value, targetTeam.id, memberNodeFor(user, targetTeam.id));
        expandedIds.add(targetTeam.id);
        scheduleSave();
        logOrgActivity({
            action: 'org_member_assign',
            target_id: targetTeam.id,
            target_name: displayName(targetTeam),
            after_value: { members: [user.username || user.email || user.id], team: displayName(targetTeam) },
            comment: '드래그 이동'
        });
        await syncUserDepartments([payload.id]);
        toast(t('OrganizationChartView.memberAssigned', { name: user.username || user.email, team: displayName(targetTeam) }));
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
    logOrgActivity({ action: 'org_team_create', target_id: team.id, target_name: name });
    toast(t('OrganizationChartView.teamAdded', { name }));
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
    logOrgActivity({
        action: 'org_team_delete',
        target_id: team.id,
        target_name: displayName(team),
        before_value: { memberCount: affected.length }
    });
    const pendingIds = affected.filter((id) => pendingMembers.value.some((member) => member.id === id));
    if (pendingIds.length) {
        const { error } = await window.$supabase.from('pending_org_members').delete().in('id', pendingIds);
        if (error) toast(t('OrganizationChartView.pendingCleanupFailed'), 'warning');
        else {
            pendingMembers.value = pendingMembers.value.filter((member) => !pendingIds.includes(member.id));
            mergeUsers();
        }
    }
    await syncUserDepartments(affected.filter((id) => !pendingIds.includes(id)));
    toast(t('OrganizationChartView.teamDeleted', { name: displayName(team) }));
    removeTeamTarget.value = null;
}

function onUpdateTeam({ team, patch }) {
    const target = findNode(root.value, team.id);
    if (!target) return;
    if (patch.name && isDuplicateTeamName(root.value, patch.name, target.id)) {
        toast(t('OrganizationChartView.duplicateTeamName'), 'warning');
        return;
    }
    // 변경 필드의 이전/이후 값만 추려 로그에 남긴다
    const before = {};
    const after = {};
    for (const key of Object.keys(patch)) {
        before[key] = key === 'name' ? target.name ?? target.data?.name : target.data?.[key];
        after[key] = patch[key];
    }
    target.data = { ...target.data, ...patch };
    if (patch.name) target.name = patch.name;
    scheduleSave();
    logOrgActivity({
        action: 'org_team_update',
        target_id: target.id,
        target_name: displayName(target),
        before_value: before,
        after_value: after
    });
}

function onMoveTeam({ team, parentId }) {
    if (!moveNode(root.value, team.id, parentId)) {
        toast(t('OrganizationChartView.cannotMoveThere'), 'warning');
        return;
    }
    expandedIds.add(parentId);
    scheduleSave();
    toast(t('OrganizationChartView.teamMoved'));
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
        if (!team) throw new Error(t('OrganizationChartView.teamNotFound'));
        // 목록의 이메일은 마스킹돼 있을 수 있으므로 클라이언트에서 비교하지 않는다.
        // 존재 여부만 서버가 판정한다(이메일 목록을 내려주지 않는 RPC).
        // 사전등록 쪽 중복은 pending_org_members 의 (tenant_id, lower(email))
        // 유니크 인덱스가 잡아 아래 insert 에서 23505 로 돌아온다.
        const { data: alreadyJoined, error: existsError } = await window.$supabase.rpc('tenant_user_email_exists', { p_email: email });
        if (existsError) throw existsError;
        if (alreadyJoined) throw new Error(t('OrganizationChartView.emailAlreadyJoined'));
        const { data, error } = await window.$supabase
            .from('pending_org_members')
            .insert({ tenant_id: window.$tenantName, email, team_id: team.id, role: preRegister.value.role })
            .select('id,email,role,team_id,created_at')
            .single();
        if (error) {
            if (error.code === '23505') throw new Error(t('OrganizationChartView.emailAlreadyPending'));
            throw error;
        }
        // insert 는 원본 테이블이라 반환된 email 도 원본이다. 조직도 노드는 이
        // 값(관리자가 방금 입력한 주소)을 그대로 저장해야 가입 시 매칭된다.
        const pending = { ...data, username: email, pending: true, is_agent: false, department_id: team.id };
        pendingMembers.value.push(pending);
        mergeUsers();
        attachNode(root.value, team.id, memberNodeFor(pending, team.id));
        expandedIds.add(team.id);
        const saved = await persist();
        if (!saved) {
            removeMemberFromTeam(root.value, team.id, pending.id);
            pendingMembers.value = pendingMembers.value.filter((member) => member.id !== pending.id);
            mergeUsers();
            await window.$supabase.from('pending_org_members').delete().eq('id', pending.id);
            throw new Error(t('OrganizationChartView.preRegisterRolledBack'));
        }
        preRegisterDialog.value = false;
        toast(t('OrganizationChartView.preRegistered', { email }));
    } catch (error) {
        console.error('[OrganizationChart] 구성원 사전등록 실패:', error);
        toast(error?.message || t('OrganizationChartView.preRegisterFailed'), 'error');
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
        if (attachNode(root.value, target.id, memberNodeFor(user, target.id))) added += 1;
    }
    if (!added) return;
    expandedIds.add(target.id);
    scheduleSave();
    const memberNames = userIds
        .map((userId) => users.value.find((candidate) => candidate.id === userId))
        .filter(Boolean)
        .map((user) => user.username || user.email || user.id);
    logOrgActivity({
        action: 'org_member_assign',
        target_id: target.id,
        target_name: displayName(target),
        after_value: { members: memberNames, team: displayName(target) }
    });
    await syncUserDepartments(userIds);
    toast(tc('OrganizationChartView.membersAdded', added, { n: added, team: displayName(target) }));
}

async function onRemoveMember({ team, member }) {
    if (!removeMemberFromTeam(root.value, team.id, member.id)) return;
    if (team.data?.leaderId === member.id) {
        const target = findNode(root.value, team.id);
        if (target) target.data = { ...target.data, leaderId: undefined };
    }
    if (selectedId.value === member.id) selectedId.value = team.id;
    scheduleSave();
    logOrgActivity({
        action: 'org_member_remove',
        target_id: member.id,
        target_name: displayName(member),
        before_value: { team: displayName(team) }
    });
    const pending = pendingMembers.value.find((candidate) => candidate.id === member.id);
    if (pending) {
        const { error } = await window.$supabase.from('pending_org_members').delete().eq('id', member.id);
        if (error) {
            toast(t('OrganizationChartView.pendingRemoveFailed'), 'error');
            return;
        }
        pendingMembers.value = pendingMembers.value.filter((candidate) => candidate.id !== member.id);
        mergeUsers();
    } else {
        await syncUserDepartments([member.id]);
    }
    toast(t('OrganizationChartView.memberRemoved', { name: displayName(member) }));
}

async function onMoveMember({ member, fromTeam, toTeamId }) {
    const targetTeam = findNode(root.value, toTeamId);
    if (!targetTeam) return;
    if (fromTeam) removeMemberFromTeam(root.value, fromTeam.id, member.id);
    const user = users.value.find((candidate) => candidate.id === member.id);
    attachNode(root.value, toTeamId, user ? memberNodeFor(user, toTeamId) : { ...member, children: undefined });
    expandedIds.add(toTeamId);
    scheduleSave();
    const pending = pendingMembers.value.find((candidate) => candidate.id === member.id);
    if (pending) {
        const { error } = await window.$supabase.from('pending_org_members').update({ team_id: toTeamId }).eq('id', member.id);
        if (error) toast(t('OrganizationChartView.pendingMoveFailed'), 'error');
        else pending.team_id = toTeamId;
    } else {
        await syncUserDepartments([member.id]);
    }
    toast(t('OrganizationChartView.memberMoved', { name: displayName(member), team: displayName(targetTeam) }));
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
        // 단건(onUpdateRole)·일괄(onUpdateRoles) 모두 여기 한 곳에서만 기록해 중복을 막는다
        logOrgActivity({
            action: 'org_role_update',
            target_id: userId,
            target_name: user.username || user.email || String(userId),
            before_value: { role: previousRole },
            after_value: { role }
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
        toast(t('OrganizationChartView.roleChanged'));
    } else {
        toast(t('OrganizationChartView.roleChangeFailed'), 'error');
    }
}

async function onUpdateRoles({ userIds, role }) {
    const results = await Promise.all(userIds.map((userId) => applyRole(userId, role)));
    const succeeded = results.filter(Boolean).length;
    if (succeeded) {
        scheduleSave();
        toast(tc('OrganizationChartView.rolesChanged', succeeded, { n: succeeded }));
    }
    if (succeeded < userIds.length) {
        toast(tc('OrganizationChartView.rolesChangeSkipped', userIds.length - succeeded, { n: userIds.length - succeeded }), 'warning');
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
    attachNode(root.value, target.id, memberNodeFor({ ...agent, is_agent: true }, target.id));
    expandedIds.add(target.id);
    scheduleSave();
    toast(t('OrganizationChartView.agentAdded', { name: agent.name, team: displayName(target) }));
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
            toast(t('OrganizationChartView.agentDeleteFailed'), 'error');
            return;
        }
        removeNodeEverywhere(root.value, id);
        users.value = users.value.filter((user) => user.id !== id);
        eventBus?.emit('agentDeleted', { id });
        scheduleSave();
        // 위에서 이미 노드를 제거했으므로 onAgentDeleted 쪽에서는 다시 기록되지 않는다
        logOrgActivity({ action: 'org_agent_delete', target_id: id, target_name: data?.name || editNode?.name || String(id) });
        toast(t('OrganizationChartView.agentDeleted'));
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
            toast(t('OrganizationChartView.agentUpdateFailed'), 'error');
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
        toast(t('OrganizationChartView.agentUpdated'));
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
    const deletedUser = users.value.find((candidate) => candidate.id === userId);
    const removed = removeNodeEverywhere(root.value, userId);
    if (removed) scheduleSave();
    users.value = users.value.filter((user) => user.id !== userId);
    // 조직도에 없던 사용자면 저장이 없으므로 일반 로그 억제 플래그는 세우지 않는다
    logOrgActivity(
        { action: 'org_user_delete', target_id: userId, target_name: deletedUser?.username || deletedUser?.email || String(userId) },
        removed
    );
}
async function onAgentDeleted(payload) {
    const id = payload?.id || payload;
    if (!id) return;
    if (removeNodeEverywhere(root.value, id)) {
        scheduleSave();
        // 이 화면의 삭제(onAgentDialogSubmit)는 노드를 먼저 지우고 이벤트를 쏘므로
        // 여기서는 화면 밖에서 삭제된 에이전트가 조직도에 남아 있던 경우만 기록된다
        const agentUser = users.value.find((candidate) => candidate.id === id);
        logOrgActivity({ action: 'org_agent_delete', target_id: id, target_name: agentUser?.username || agentUser?.name || String(id) });
    }
    users.value = users.value.filter((user) => user.id !== id);
}
async function onAgentAdded(agent) {
    await loadUsers();
    // 생성 1건당 1회 — 팀 배치 체크 시 뒤따르는 onAgentAssigned 의 조직도 저장은 이 로그가 함께 설명한다
    if (agent?.id) {
        logOrgActivity({ action: 'org_agent_create', target_id: agent.id, target_name: agent.name || agent.username || String(agent.id) });
    }
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

.org-tabs {
    flex: none;
    padding: 0 16px;
    border-bottom: 1px solid var(--cds-border);
}
.org-chart-tab {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
}
.org-approvals-tab {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
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

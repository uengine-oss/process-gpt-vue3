<template>
    <aside class="org-panel">
        <v-tabs v-model="tab" density="compact" color="primary" class="org-panel__tabs" grow>
            <v-tab value="team" class="text-none">부서 정보</v-tab>
            <v-tab value="members" class="text-none">구성원</v-tab>
            <v-tab value="roles" class="text-none">권한 관리</v-tab>
        </v-tabs>

        <v-window v-model="tab" class="org-panel__body">
            <!-- ───────────────── 부서 정보 ───────────────── -->
            <v-window-item value="team" class="org-panel__pane">
                <div v-if="!team" class="org-panel__empty">
                    <v-icon size="34">mdi-file-tree-outline</v-icon>
                    <p>조직도에서 부서를 선택하세요.</p>
                </div>

                <template v-else>
                    <div class="org-panel__breadcrumb">{{ teamPath }}</div>

                    <v-text-field
                        v-model="form.name"
                        label="부서명"
                        variant="outlined"
                        density="compact"
                        hide-details="auto"
                        :readonly="!editable"
                        :error-messages="nameError"
                        class="mb-3"
                        @blur="commitName"
                        @keyup.enter="commitName"
                    />

                    <v-textarea
                        v-model="form.description"
                        label="설명"
                        variant="outlined"
                        density="compact"
                        rows="2"
                        auto-grow
                        hide-details="auto"
                        :readonly="!editable"
                        class="mb-3"
                        @blur="commitDescription"
                    />

                    <v-select
                        v-model="form.leaderId"
                        :items="leaderItems"
                        item-title="title"
                        item-value="value"
                        label="부서장"
                        variant="outlined"
                        density="compact"
                        hide-details="auto"
                        clearable
                        :disabled="!editable"
                        class="mb-3"
                        @update:model-value="commitLeader"
                    />

                    <v-select
                        v-if="!isRootTeam"
                        v-model="form.parentId"
                        :items="parentItems"
                        item-title="title"
                        item-value="value"
                        label="상위 부서"
                        variant="outlined"
                        density="compact"
                        hide-details="auto"
                        :disabled="!editable"
                        class="mb-4"
                        @update:model-value="commitParent"
                    />

                    <div class="org-stats">
                        <div class="org-stats__cell">
                            <span class="org-stats__value">{{ directMembers.length }}</span>
                            <span class="org-stats__label">직속 구성원</span>
                        </div>
                        <div class="org-stats__cell">
                            <span class="org-stats__value">{{ allMembers.length }}</span>
                            <span class="org-stats__label">전체 구성원</span>
                        </div>
                        <div class="org-stats__cell">
                            <span class="org-stats__value">{{ subTeams.length }}</span>
                            <span class="org-stats__label">하위 부서</span>
                        </div>
                    </div>

                    <div v-if="editable" class="d-flex flex-column ga-2 mt-4">
                        <v-btn
                            variant="tonal"
                            color="primary"
                            class="text-none"
                            prepend-icon="mdi-plus-box-outline"
                            @click="$emit('add-team', team)"
                        >
                            하위 부서 추가
                        </v-btn>
                        <v-btn
                            v-if="!isRootTeam"
                            variant="tonal"
                            color="error"
                            class="text-none org-panel__delete-team"
                            prepend-icon="mdi-trash-can-outline"
                            @click="$emit('remove-team', team)"
                        >
                            부서 삭제
                        </v-btn>
                    </div>
                </template>
            </v-window-item>

            <!-- ───────────────── 구성원 ───────────────── -->
            <v-window-item value="members" class="org-panel__pane">
                <div v-if="!team" class="org-panel__empty">
                    <v-icon size="34">mdi-account-multiple-outline</v-icon>
                    <p>부서를 선택하면 구성원을 관리할 수 있습니다.</p>
                </div>

                <template v-else>
                    <div class="org-panel__section-head">
                        <span class="org-panel__section-title">{{ teamName }}</span>
                        <span class="org-panel__count">{{ directMembers.length }}명</span>
                    </div>

                    <div v-if="editable" class="mb-3">
                        <v-autocomplete
                            v-model="pendingMemberIds"
                            :items="assignableUsers"
                            item-title="label"
                            item-value="id"
                            label="구성원 추가"
                            placeholder="이름 또는 이메일로 검색"
                            variant="outlined"
                            density="compact"
                            multiple
                            chips
                            closable-chips
                            hide-details
                            class="mb-2"
                        >
                            <template #item="{ props: itemProps, item }">
                                <v-list-item v-bind="itemProps" :subtitle="item.raw.email">
                                    <template #prepend>
                                        <v-avatar size="28" class="mr-2">
                                            <v-img v-if="item.raw.profile" :src="item.raw.profile" cover />
                                            <v-icon v-else size="18">{{ item.raw.is_agent ? 'mdi-robot-outline' : 'mdi-account' }}</v-icon>
                                        </v-avatar>
                                    </template>
                                    <template #append>
                                        <span v-if="item.raw.teamLabel" class="org-hint">{{ item.raw.teamLabel }}</span>
                                        <span v-else class="org-hint org-hint--warn">미배치</span>
                                    </template>
                                </v-list-item>
                            </template>
                        </v-autocomplete>

                        <div class="d-flex ga-2">
                            <v-btn
                                size="small"
                                color="primary"
                                variant="flat"
                                class="text-none flex-grow-1 org-panel__add-members"
                                :disabled="!pendingMemberIds.length"
                                @click="commitAddMembers"
                            >
                                {{ pendingMemberIds.length ? `${pendingMemberIds.length}명 추가` : '추가' }}
                            </v-btn>
                            <v-btn
                                size="small"
                                variant="tonal"
                                class="text-none"
                                prepend-icon="mdi-robot-outline"
                                @click="$emit('create-agent', team)"
                            >
                                에이전트
                            </v-btn>
                        </div>
                        <label class="org-toggle mt-2">
                            <input v-model="includeAssigned" type="checkbox" />
                            <span>이미 다른 부서에 배치된 인원도 선택 목록에 표시</span>
                        </label>
                    </div>

                    <div v-if="!directMembers.length" class="org-panel__empty org-panel__empty--sm">
                        <p>이 부서에 배치된 구성원이 없습니다.</p>
                    </div>

                    <ul class="org-member-list">
                        <li
                            v-for="member in directMembers"
                            :key="member.id"
                            class="org-member-row"
                            :class="{ 'org-member-row--selected': selectedId === member.id }"
                            @click="$emit('select-member', member)"
                        >
                            <v-avatar size="32" class="org-member-row__avatar">
                                <v-img v-if="memberProfile(member)" :src="memberProfile(member)" cover />
                                <v-icon v-else size="18">{{ memberIsAgent(member) ? 'mdi-robot-outline' : 'mdi-account' }}</v-icon>
                            </v-avatar>

                            <div class="org-member-row__info">
                                <div class="org-member-row__name">
                                    <span class="org-member-row__label">{{ memberName(member) }}</span>
                                    <v-icon v-if="member.id === team.data?.leaderId" size="12" color="warning">
                                        mdi-star-four-points
                                    </v-icon>
                                    <span v-if="memberIsAgent(member)" class="org-tag">AGENT</span>
                                    <span v-if="memberPending(member)" class="org-tag org-tag--pending">가입 대기</span>
                                </div>
                                <div class="org-member-row__sub">{{ memberEmail(member) || '이메일 없음' }}</div>
                            </div>

                            <div class="org-member-row__role" @click.stop>
                                <v-select
                                    v-if="canEditRole(member.id)"
                                    :model-value="roleOf(member.id)"
                                    :items="roleItems"
                                    item-title="title"
                                    item-value="value"
                                    variant="plain"
                                    density="compact"
                                    hide-details
                                    class="org-role-select"
                                    @update:model-value="(value) => $emit('update-role', { userId: member.id, role: value })"
                                />
                                <v-chip v-else size="x-small" :color="roleColor(member.id)" variant="tonal">
                                    {{ roleLabel(member.id) }}
                                </v-chip>
                            </div>

                            <v-menu v-if="editable" location="bottom end">
                                <template #activator="{ props: menuProps }">
                                    <v-btn v-bind="menuProps" icon size="x-small" variant="text" @click.stop>
                                        <v-icon size="18">mdi-dots-vertical</v-icon>
                                    </v-btn>
                                </template>
                                <v-list density="compact">
                                    <v-list-item
                                        :title="member.id === team.data?.leaderId ? '부서장 해제' : '부서장으로 지정'"
                                        prepend-icon="mdi-star-four-points"
                                        @click="
                                            $emit('set-leader', { team, memberId: member.id === team.data?.leaderId ? null : member.id })
                                        "
                                    />
                                    <v-list-item title="다른 부서로 이동" prepend-icon="mdi-swap-horizontal" @click="startMove(member)" />
                                    <template v-if="memberIsAgent(member)">
                                        <v-divider class="my-1" />
                                        <v-list-item
                                            title="에이전트 상세"
                                            prepend-icon="mdi-information-outline"
                                            @click="$emit('show-agent', member)"
                                        />
                                        <v-list-item
                                            title="에이전트 수정"
                                            prepend-icon="mdi-pencil-outline"
                                            @click="$emit('edit-agent', member)"
                                        />
                                        <v-list-item
                                            title="에이전트 삭제"
                                            prepend-icon="mdi-robot-off-outline"
                                            base-color="error"
                                            @click="$emit('delete-agent', member)"
                                        />
                                        <v-divider class="my-1" />
                                    </template>
                                    <v-list-item
                                        title="부서에서 제외"
                                        prepend-icon="mdi-account-remove-outline"
                                        base-color="error"
                                        @click="$emit('remove-member', { team, member })"
                                    />
                                </v-list>
                            </v-menu>
                        </li>
                    </ul>

                    <div v-if="nestedMembers.length" class="org-panel__nested">
                        <span>하위 부서 구성원 {{ nestedMembers.length }}명</span>
                    </div>
                </template>
            </v-window-item>

            <!-- ───────────────── 권한 관리 ───────────────── -->
            <v-window-item value="roles" class="org-panel__pane">
                <v-text-field
                    v-model="roleSearch"
                    placeholder="이름 · 이메일 검색"
                    variant="outlined"
                    density="compact"
                    hide-details
                    prepend-inner-icon="mdi-magnify"
                    clearable
                    class="mb-2"
                />

                <div class="org-filter-chips mb-2">
                    <v-chip
                        :variant="roleFilter === 'all' ? 'flat' : 'outlined'"
                        :color="roleFilter === 'all' ? 'primary' : undefined"
                        size="x-small"
                        @click="roleFilter = 'all'"
                    >
                        전체 {{ manageableUsers.length }}
                    </v-chip>
                    <v-chip
                        v-for="role in roleItems"
                        :key="role.value"
                        :variant="roleFilter === role.value ? 'flat' : 'outlined'"
                        :color="roleFilter === role.value ? role.color : undefined"
                        size="x-small"
                        @click="roleFilter = role.value"
                    >
                        {{ role.title }} {{ roleCounts[role.value] || 0 }}
                    </v-chip>
                    <v-chip
                        :variant="roleFilter === 'unassigned' ? 'flat' : 'outlined'"
                        :color="roleFilter === 'unassigned' ? 'warning' : undefined"
                        size="x-small"
                        @click="roleFilter = 'unassigned'"
                    >
                        미배치 {{ unassignedCount }}
                    </v-chip>
                </div>

                <div v-if="canManageRoles && selectedUserIds.length" class="org-bulk">
                    <span class="org-bulk__label">{{ selectedUserIds.length }}명 선택</span>
                    <v-select
                        v-model="bulkRole"
                        :items="roleItems"
                        item-title="title"
                        item-value="value"
                        placeholder="역할 일괄 적용"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="org-bulk__select"
                    />
                    <v-btn size="small" color="primary" variant="flat" class="text-none" :disabled="!bulkRole" @click="commitBulkRole">
                        적용
                    </v-btn>
                    <v-btn size="small" variant="text" class="text-none" @click="selectedUserIds = []">해제</v-btn>
                </div>

                <div v-if="!filteredRoleUsers.length" class="org-panel__empty org-panel__empty--sm">
                    <p>조건에 맞는 사용자가 없습니다.</p>
                </div>

                <ul class="org-member-list">
                    <li v-for="user in filteredRoleUsers" :key="user.id" class="org-member-row org-member-row--role">
                        <input v-if="canEditRole(user.id)" v-model="selectedUserIds" type="checkbox" :value="user.id" class="org-check" />
                        <span v-else class="org-check org-check--placeholder"></span>

                        <v-avatar size="30" class="org-member-row__avatar">
                            <v-img v-if="user.profile" :src="user.profile" cover />
                            <v-icon v-else size="17">{{ user.is_agent ? 'mdi-robot-outline' : 'mdi-account' }}</v-icon>
                        </v-avatar>

                        <div class="org-member-row__info">
                            <div class="org-member-row__name">
                                <span class="org-member-row__label">{{ user.label }}</span>
                                <span v-if="user.id === currentUserId" class="org-tag org-tag--me">나</span>
                                <span v-if="user.is_agent" class="org-tag">AGENT</span>
                                <span v-if="user.pending" class="org-tag org-tag--pending">가입 대기</span>
                            </div>
                            <div class="org-member-row__sub" :title="user.teamLabel || '미배치'">
                                <span v-if="user.teamLabel">{{ user.teamLabel }}</span>
                                <span v-else class="org-hint--warn">미배치</span>
                            </div>
                        </div>

                        <div class="org-member-row__role" @click.stop>
                            <v-select
                                v-if="canEditRole(user.id)"
                                :model-value="roleOf(user.id)"
                                :items="roleItems"
                                item-title="title"
                                item-value="value"
                                variant="plain"
                                density="compact"
                                hide-details
                                class="org-role-select"
                                @update:model-value="(value) => $emit('update-role', { userId: user.id, role: value })"
                            />
                            <v-chip v-else size="x-small" :color="roleColor(user.id)" variant="tonal">
                                {{ roleLabel(user.id) }}
                            </v-chip>
                        </div>
                    </li>
                </ul>

                <div class="org-legend">
                    <div v-for="role in roleItems" :key="role.value" class="org-legend__row">
                        <v-chip size="x-small" :color="role.color" variant="tonal">{{ role.title }}</v-chip>
                        <span class="org-legend__desc"
                            ><b>{{ role.titleEn }}</b> — {{ role.description }}</span
                        >
                    </div>
                </div>
            </v-window-item>
        </v-window>

        <!-- 구성원 이동 -->
        <v-dialog v-model="moveDialog" max-width="420">
            <v-card class="pa-4">
                <v-card-title class="pa-0 pb-3 text-h6">구성원 이동</v-card-title>
                <v-card-text class="pa-0">
                    <p class="mb-3 org-hint">{{ moveTarget ? memberName(moveTarget) : '' }} 님을 이동할 부서를 선택하세요.</p>
                    <v-select
                        v-model="moveTargetTeamId"
                        :items="parentItems"
                        item-title="title"
                        item-value="value"
                        label="이동할 부서"
                        variant="outlined"
                        density="compact"
                        hide-details
                    />
                </v-card-text>
                <v-card-actions class="pa-0 pt-4">
                    <v-spacer />
                    <v-btn variant="text" class="text-none" @click="moveDialog = false">취소</v-btn>
                    <v-btn color="primary" variant="flat" class="text-none" :disabled="!moveTargetTeamId" @click="commitMove">이동</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </aside>
</template>

<script>
export default { name: 'OrgDetailPanel' };
</script>

<script setup>
import { computed, ref, watch } from 'vue';
import { ROLE_HIERARCHY, ROLE_META } from '@/utils/roles';
import {
    childMembers,
    childTeams,
    collectMembers,
    collectTeams,
    displayName,
    isAgentNode,
    isDuplicateTeamName,
    pathLabel
} from './orgChartModel';

const props = defineProps({
    root: { type: Object, default: null },
    team: { type: Object, default: null },
    selectedId: { type: String, default: null },
    users: { type: Array, default: () => [] },
    editable: { type: Boolean, default: false },
    canManageRoles: { type: Boolean, default: false },
    currentUserId: { type: String, default: '' }
});

const emit = defineEmits([
    'update-team',
    'add-team',
    'remove-team',
    'move-team',
    'add-members',
    'remove-member',
    'move-member',
    'set-leader',
    'update-role',
    'update-roles',
    'select-member',
    'create-agent',
    'show-agent',
    'edit-agent',
    'delete-agent'
]);

const tab = ref('team');
const pendingMemberIds = ref([]);
const includeAssigned = ref(false);
const roleSearch = ref('');
const roleFilter = ref('all');
const selectedUserIds = ref([]);
const bulkRole = ref(null);
const moveDialog = ref(false);
const moveTarget = ref(null);
const moveTargetTeamId = ref(null);

const form = ref({ name: '', description: '', leaderId: null, parentId: null });

const isRootTeam = computed(() => props.team?.id === 'root');
const teamName = computed(() => displayName(props.team));
const teamPath = computed(() => (props.team ? pathLabel(props.root, props.team.id) : ''));
const directMembers = computed(() => childMembers(props.team));
const allMembers = computed(() => collectMembers(props.team, true));
const subTeams = computed(() => childTeams(props.team));
const nestedMembers = computed(() => {
    const directIds = new Set(directMembers.value.map((member) => member.id));
    return allMembers.value.filter((member) => !directIds.has(member.id));
});

watch(
    () => props.team,
    (team) => {
        pendingMemberIds.value = [];
        if (!team) return;
        const parent = props.root ? findParentId(team.id) : null;
        form.value = {
            name: displayName(team),
            description: team.data?.description || '',
            leaderId: team.data?.leaderId || null,
            parentId: parent
        };
    },
    { immediate: true, deep: false }
);

function findParentId(teamId) {
    let parentId = null;
    const step = (node) => {
        for (const child of node.children || []) {
            if (child.id === teamId) parentId = node.id;
            else step(child);
        }
    };
    if (props.root) step(props.root);
    return parentId;
}

/* ── 역할 ───────────────────────────────────────────── */

const roleItems = computed(() =>
    ROLE_HIERARCHY.map((role) => ({
        value: role,
        title: ROLE_META[role].label,
        titleEn: ROLE_META[role].labelEn,
        color: ROLE_META[role].color,
        description: ROLE_META[role].description
    }))
);

const userById = computed(() => {
    const map = new Map();
    for (const user of props.users) map.set(user.id, user);
    return map;
});

function roleOf(userId) {
    const user = userById.value.get(userId);
    if (!user) return null;
    if (user.role) return user.role;
    return user.is_admin ? 'admin' : 'viewer';
}
function roleLabel(userId) {
    const role = roleOf(userId);
    if (!role) return '-';
    if (role === 'superAdmin') return '최고관리자';
    return ROLE_META[role]?.label || role;
}
function roleColor(userId) {
    const role = roleOf(userId);
    if (role === 'superAdmin') return 'error';
    return ROLE_META[role]?.color || 'grey';
}
function canEditRole(userId) {
    if (!props.canManageRoles) return false;
    if (userId === props.currentUserId) return false;
    const user = userById.value.get(userId);
    if (!user) return false;
    if (user.role === 'superAdmin') return false;
    return true;
}

/* ── 사용자 목록 (경로 라벨 포함) ────────────────────── */

const memberTeamLabels = computed(() => {
    const map = new Map();
    if (!props.root) return map;
    const step = (node, path) => {
        const nextPath = node.data?.isTeam || node.id === 'root' ? [...path, displayName(node)] : path;
        for (const child of node.children || []) {
            if (child.data?.isTeam) {
                step(child, nextPath);
            } else {
                const label = nextPath.join(' / ');
                const existing = map.get(child.id);
                map.set(child.id, existing ? `${existing}, ${label}` : label);
            }
        }
    };
    step(props.root, []);
    return map;
});

const decoratedUsers = computed(() =>
    props.users.map((user) => ({
        ...user,
        label: user.username || user.name || user.email || user.id,
        teamLabel: memberTeamLabels.value.get(user.id) || ''
    }))
);

const manageableUsers = computed(() => decoratedUsers.value);

const assignableUsers = computed(() => {
    const currentIds = new Set(directMembers.value.map((member) => member.id));
    return decoratedUsers.value.filter((user) => {
        if (currentIds.has(user.id)) return false;
        if (!includeAssigned.value && user.teamLabel) return false;
        return true;
    });
});

const unassignedCount = computed(() => decoratedUsers.value.filter((user) => !user.teamLabel).length);

const roleCounts = computed(() => {
    const counts = {};
    for (const user of decoratedUsers.value) {
        const role = roleOf(user.id);
        if (!role) continue;
        counts[role] = (counts[role] || 0) + 1;
    }
    return counts;
});

const filteredRoleUsers = computed(() => {
    const query = (roleSearch.value || '').trim().toLowerCase();
    return decoratedUsers.value.filter((user) => {
        if (query) {
            const haystack = `${user.label} ${user.email || ''}`.toLowerCase();
            if (!haystack.includes(query)) return false;
        }
        if (roleFilter.value === 'all') return true;
        if (roleFilter.value === 'unassigned') return !user.teamLabel;
        return roleOf(user.id) === roleFilter.value;
    });
});

/* ── 부서 선택 목록 ─────────────────────────────────── */

const parentItems = computed(() => {
    if (!props.root) return [];
    return collectTeams(props.root, true)
        .filter((entry) => {
            if (!props.team) return true;
            if (entry.node.id === props.team.id) return false;
            return !isDescendantOfTeam(entry.node.id);
        })
        .map((entry) => ({
            value: entry.node.id,
            title: `${'  '.repeat(entry.depth)}${displayName(entry.node)}`
        }));
});

function isDescendantOfTeam(candidateId) {
    if (!props.team) return false;
    let hit = false;
    const step = (node) => {
        for (const child of node.children || []) {
            if (child.id === candidateId) hit = true;
            else step(child);
        }
    };
    step(props.team);
    return hit;
}

const leaderItems = computed(() => directMembers.value.map((member) => ({ value: member.id, title: displayName(member) })));

/* ── 커밋 핸들러 ────────────────────────────────────── */

const nameError = computed(() => {
    if (!props.team || !props.editable) return '';
    const name = (form.value.name || '').trim();
    if (!name) return '부서명을 입력하세요.';
    if (isDuplicateTeamName(props.root, name, props.team.id)) return '이미 같은 이름의 부서가 있습니다.';
    return '';
});

function commitName() {
    if (!props.editable || !props.team) return;
    const name = (form.value.name || '').trim();
    if (nameError.value) return; // 중복/빈 값이면 저장하지 않고 오류만 표시
    if (name === displayName(props.team)) {
        form.value.name = displayName(props.team);
        return;
    }
    emit('update-team', { team: props.team, patch: { name } });
}

function commitDescription() {
    if (!props.editable || !props.team) return;
    const description = form.value.description || '';
    if (description === (props.team.data?.description || '')) return;
    emit('update-team', { team: props.team, patch: { description } });
}

function commitLeader(value) {
    if (!props.editable || !props.team) return;
    emit('set-leader', { team: props.team, memberId: value || null });
}

function commitParent(value) {
    if (!props.editable || !props.team || !value) return;
    if (value === findParentId(props.team.id)) return;
    emit('move-team', { team: props.team, parentId: value });
}

function commitAddMembers() {
    if (!props.team || !pendingMemberIds.value.length) return;
    emit('add-members', { team: props.team, userIds: [...pendingMemberIds.value] });
    pendingMemberIds.value = [];
}

function startMove(member) {
    moveTarget.value = member;
    moveTargetTeamId.value = null;
    moveDialog.value = true;
}
function commitMove() {
    if (!moveTarget.value || !moveTargetTeamId.value) return;
    emit('move-member', { member: moveTarget.value, fromTeam: props.team, toTeamId: moveTargetTeamId.value });
    moveDialog.value = false;
    moveTarget.value = null;
}

function commitBulkRole() {
    if (!bulkRole.value || !selectedUserIds.value.length) return;
    emit('update-roles', { userIds: [...selectedUserIds.value], role: bulkRole.value });
    selectedUserIds.value = [];
    bulkRole.value = null;
}

/* ── 표시 헬퍼 ──────────────────────────────────────── */

function memberName(member) {
    const user = userById.value.get(member.id);
    return user?.username || user?.name || displayName(member);
}
function memberEmail(member) {
    const user = userById.value.get(member.id);
    return user?.email || member.data?.email || '';
}
function memberProfile(member) {
    const user = userById.value.get(member.id);
    const src = user?.profile || member.data?.profile || member.data?.img;
    return src && src !== '/images/defaultUser.png' ? src : '';
}
function memberIsAgent(member) {
    const user = userById.value.get(member.id);
    return !!(user?.is_agent ?? isAgentNode(member));
}
function memberPending(member) {
    const user = userById.value.get(member.id);
    return !!(user?.pending ?? member.data?.pending);
}

defineExpose({
    focusMembers: () => {
        tab.value = 'members';
    },
    focusRoles: () => {
        tab.value = 'roles';
    }
});
</script>

<style scoped>
.org-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--cds-surface-panel);
    border-left: 1px solid var(--cds-border);
}
.org-panel__tabs {
    flex: none;
    border-bottom: 1px solid var(--cds-border);
}
.org-panel__body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
}
.org-panel__body :deep(.v-window__container) {
    height: 100%;
}
.org-panel__pane {
    height: 100%;
    overflow-y: auto;
    padding: 16px;
}

.org-panel__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 48px 16px;
    color: var(--cds-text-muted);
    text-align: center;
    font-size: var(--cds-font-size-footnote);
}
.org-panel__empty--sm {
    padding: 24px 8px;
}

.org-panel__breadcrumb {
    font-size: var(--cds-font-size-caption);
    color: var(--cds-text-muted);
    margin-bottom: 10px;
    word-break: break-all;
}

.org-panel__section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 10px;
}
.org-panel__section-title {
    font-size: var(--cds-font-size-heading);
    font-weight: var(--cds-font-weight-semibold);
    color: var(--cds-text-primary);
}
.org-panel__count {
    font-size: var(--cds-font-size-caption);
    color: var(--cds-text-muted);
}

.org-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
}
.org-stats__cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 10px 4px;
    background: var(--cds-bg-neutral);
    border-radius: var(--cds-radius);
}
.org-stats__value {
    font-size: 18px;
    font-weight: var(--cds-font-weight-bold);
    color: var(--cds-text-primary);
}
.org-stats__label {
    font-size: var(--cds-font-size-caption);
    color: var(--cds-text-muted);
}

.org-member-list {
    list-style: none;
    padding: 0;
    margin: 0;
}
.org-member-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 4px;
    border-bottom: 1px solid var(--cds-border);
    cursor: pointer;
}
.org-member-row:hover {
    background: var(--cds-bg-neutral);
}
.org-member-row--selected {
    background: rgba(var(--v-theme-primary), 0.1);
}
.org-member-row--role {
    cursor: default;
}
.org-member-row__avatar {
    flex: none;
    background: var(--cds-bg-neutral);
    color: var(--cds-text-muted);
}
.org-member-row__info {
    flex: 1;
    min-width: 0;
}
.org-member-row__name {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--cds-font-size-body--xs);
    font-weight: var(--cds-font-weight-medium);
    color: var(--cds-text-primary);
    white-space: nowrap;
    min-width: 0;
}
/* 이름만 줄어들고 배지는 온전히 남도록 */
.org-member-row__label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
}
.org-member-row__sub {
    font-size: var(--cds-font-size-caption);
    color: var(--cds-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.org-member-row__role {
    flex: none;
    width: 116px;
    display: flex;
    justify-content: flex-end;
}
.org-role-select :deep(.v-field__input) {
    padding: 0;
    min-height: 24px;
    font-size: var(--cds-font-size-caption);
}
.org-role-select :deep(.v-field__append-inner) {
    padding: 0;
}

.org-tag {
    flex: none;
    white-space: nowrap;
    font-size: 9px;
    font-weight: var(--cds-font-weight-bold);
    letter-spacing: 0.04em;
    padding: 1px 4px;
    border-radius: 4px;
    background: var(--cds-bg-neutral);
    color: var(--cds-text-muted);
}
.org-tag--me {
    background: rgba(var(--v-theme-primary), 0.14);
    color: rgb(var(--v-theme-primary));
}

.org-hint {
    font-size: var(--cds-font-size-caption);
    color: var(--cds-text-muted);
}
.org-hint--warn {
    color: var(--cds-text-warning);
}

.org-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--cds-font-size-caption);
    color: var(--cds-text-muted);
    cursor: pointer;
}

.org-panel__nested {
    margin-top: 12px;
    padding: 8px;
    background: var(--cds-bg-neutral);
    border-radius: var(--cds-radius--sm);
    font-size: var(--cds-font-size-caption);
    color: var(--cds-text-muted);
}

.org-filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.org-bulk {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px;
    margin-bottom: 8px;
    background: rgba(var(--v-theme-primary), 0.07);
    border-radius: var(--cds-radius--sm);
}
.org-bulk__label {
    font-size: var(--cds-font-size-caption);
    color: var(--cds-text-secondary);
    white-space: nowrap;
}
.org-bulk__select {
    flex: 1;
    min-width: 0;
}

.org-check {
    flex: none;
    width: 14px;
    height: 14px;
    accent-color: rgb(var(--v-theme-primary));
}
.org-check--placeholder {
    display: inline-block;
}

.org-legend {
    margin-top: 20px;
    padding-top: 12px;
    border-top: 1px solid var(--cds-border);
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.org-legend__row {
    display: flex;
    gap: 8px;
    align-items: flex-start;
}
.org-legend__row :deep(.v-chip) {
    flex: none;
}
.org-legend__desc {
    font-size: 11px;
    line-height: 1.5;
    color: var(--cds-text-muted);
}
</style>

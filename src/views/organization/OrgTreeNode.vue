<template>
    <li class="org-tree__item" :class="{ 'org-tree__item--root': depth === 0 }">
        <!-- 부서 카드 -->
        <div
            class="org-node"
            :class="[
                `org-node--depth-${Math.min(depth, 4)}`,
                {
                    'org-node--selected': selectedId === node.id,
                    'org-node--dimmed': searching && !isMatched,
                    'org-node--matched': searching && isMatched,
                    'org-node--drop-target': dropTargetId === node.id,
                    'org-node--root': depth === 0
                }
            ]"
            :draggable="editable && depth > 0"
            @click.stop="emitAction('select-team')"
            @dragstart.stop="onDragStart"
            @dragend.stop="emitAction('drag-end')"
            @dragover.prevent.stop="onDragOver"
            @dragleave.stop="onDragLeave"
            @drop.prevent.stop="onDrop"
        >
            <div class="org-node__bar"></div>

            <div class="org-node__head">
                <v-icon size="16" class="org-node__icon">{{ depth === 0 ? 'mdi-domain' : 'mdi-account-group' }}</v-icon>
                <span class="org-node__name" :title="name">{{ name }}</span>

                <button
                    v-if="childTeamList.length"
                    class="org-node__chevron"
                    :aria-label="isExpanded ? '접기' : '펼치기'"
                    @click.stop="emitAction('toggle')"
                >
                    <v-icon size="16">{{ isExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                </button>
            </div>

            <div class="org-node__meta">
                <span class="org-node__stat">
                    <v-icon size="12">mdi-account</v-icon>
                    {{ totalMemberCount }}
                </span>
                <span v-if="childTeamList.length" class="org-node__stat">
                    <v-icon size="12">mdi-file-tree-outline</v-icon>
                    {{ childTeamList.length }}
                </span>
                <span v-if="leaderName" class="org-node__leader" :title="leaderName">
                    <v-icon size="12">mdi-star-four-points</v-icon>
                    {{ leaderName }}
                </span>
            </div>

            <!-- 구성원 -->
            <div v-if="showMembers && directMembers.length" class="org-node__members">
                <div
                    v-for="member in visibleMembers"
                    :key="member.id"
                    class="org-member"
                    :class="{
                        'org-member--selected': selectedId === member.id,
                        'org-member--dimmed': searching && !matchedIds.has(member.id),
                        'org-member--leader': member.id === node.data?.leaderId
                    }"
                    :draggable="editable"
                    @click.stop="emitAction('select-member', member)"
                    @dragstart.stop="onMemberDragStart($event, member)"
                    @dragend.stop="emitAction('drag-end')"
                >
                    <v-avatar size="20" class="org-member__avatar">
                        <v-img v-if="memberImage(member)" :src="memberImage(member)" cover />
                        <v-icon v-else size="14">{{ isAgent(member) ? 'mdi-robot-outline' : 'mdi-account' }}</v-icon>
                    </v-avatar>
                    <span class="org-member__name">{{ memberName(member) }}</span>
                    <v-icon v-if="member.id === node.data?.leaderId" size="11" class="org-member__badge">mdi-star-four-points</v-icon>
                    <v-icon v-else-if="isAgent(member)" size="11" class="org-member__badge">mdi-robot-outline</v-icon>
                </div>

                <button v-if="hiddenMemberCount > 0" class="org-node__more" @click.stop="emitAction('select-team')">
                    +{{ hiddenMemberCount }}명 더보기
                </button>
            </div>

            <div v-else-if="showMembers && depth > 0" class="org-node__empty">구성원 없음</div>

            <!-- 액션 -->
            <div v-if="editable" class="org-node__actions" @click.stop>
                <v-btn icon size="x-small" variant="text" density="comfortable" :title="'하위 부서 추가'" @click.stop="emitAction('add-team')">
                    <v-icon size="15">mdi-plus-box-outline</v-icon>
                </v-btn>
                <v-btn icon size="x-small" variant="text" density="comfortable" :title="'구성원 추가'" @click.stop="emitAction('add-member')">
                    <v-icon size="15">mdi-account-plus-outline</v-icon>
                </v-btn>
                <v-btn
                    v-if="depth > 0"
                    icon
                    size="x-small"
                    variant="text"
                    density="comfortable"
                    :title="'부서 삭제'"
                    @click.stop="emitAction('remove-team')"
                >
                    <v-icon size="15">mdi-trash-can-outline</v-icon>
                </v-btn>
            </div>
        </div>

        <!-- 하위 부서 -->
        <ul v-if="childTeamList.length && isExpanded" class="org-tree__children">
            <OrgTreeNode
                v-for="child in childTeamList"
                :key="child.id"
                :node="child"
                :depth="depth + 1"
                :selected-id="selectedId"
                :expanded-ids="expandedIds"
                :matched-ids="matchedIds"
                :searching="searching"
                :show-members="showMembers"
                :editable="editable"
                :drop-target-id="dropTargetId"
                :member-limit="memberLimit"
                @action="$emit('action', $event)"
            />
        </ul>
    </li>
</template>

<script>
export default { name: 'OrgTreeNode' };
</script>

<script setup>
import { computed } from 'vue';
import { childMembers, childTeams, collectMembers, displayName, isAgentNode } from './orgChartModel';

const props = defineProps({
    node: { type: Object, required: true },
    depth: { type: Number, default: 0 },
    selectedId: { type: String, default: null },
    expandedIds: { type: Object, required: true },
    matchedIds: { type: Object, required: true },
    searching: { type: Boolean, default: false },
    showMembers: { type: Boolean, default: true },
    editable: { type: Boolean, default: false },
    dropTargetId: { type: String, default: null },
    memberLimit: { type: Number, default: 6 }
});

const emit = defineEmits(['action']);

const name = computed(() => displayName(props.node));
const childTeamList = computed(() => childTeams(props.node));
const directMembers = computed(() => childMembers(props.node));
const totalMemberCount = computed(() => collectMembers(props.node, true).length);
const isExpanded = computed(() => props.expandedIds.has(props.node.id));
const isMatched = computed(() => props.matchedIds.has(props.node.id));

const visibleMembers = computed(() =>
    props.memberLimit > 0 ? directMembers.value.slice(0, props.memberLimit) : directMembers.value
);
const hiddenMemberCount = computed(() => Math.max(0, directMembers.value.length - visibleMembers.value.length));

const leaderName = computed(() => {
    const leaderId = props.node.data?.leaderId;
    if (!leaderId) return '';
    const leader = directMembers.value.find((member) => member.id === leaderId);
    return leader ? displayName(leader) : '';
});

function memberName(member) {
    return displayName(member);
}
function memberImage(member) {
    const src = member.data?.profile || member.data?.img;
    return src && src !== '/images/defaultUser.png' ? src : '';
}
function isAgent(member) {
    return isAgentNode(member);
}

function emitAction(type, member = null) {
    emit('action', { type, node: props.node, member });
}

function onDragStart(event) {
    if (!props.editable || props.depth === 0) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', props.node.id);
    emit('action', { type: 'drag-start', node: props.node, member: null, payload: { kind: 'team', id: props.node.id } });
}

function onMemberDragStart(event, member) {
    if (!props.editable) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', member.id);
    emit('action', {
        type: 'drag-start',
        node: props.node,
        member,
        payload: { kind: 'member', id: member.id, fromTeamId: props.node.id }
    });
}

function onDragOver(event) {
    if (!props.editable) return;
    event.dataTransfer.dropEffect = 'move';
    emit('action', { type: 'drag-over', node: props.node, member: null });
}
function onDragLeave() {
    if (!props.editable) return;
    emit('action', { type: 'drag-leave', node: props.node, member: null });
}
function onDrop() {
    if (!props.editable) return;
    emit('action', { type: 'drop', node: props.node, member: null });
}
</script>

<style scoped>
.org-tree__item {
    list-style: none;
    position: relative;
    padding: 26px 8px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
}

/* 부모 → 자식 연결선 */
.org-tree__item::before,
.org-tree__item::after {
    content: '';
    position: absolute;
    top: 0;
    right: 50%;
    width: 50%;
    height: 26px;
    border-top: 1.5px solid var(--cds-border-strong);
}
.org-tree__item::after {
    right: auto;
    left: 50%;
    border-left: 1.5px solid var(--cds-border-strong);
    border-top: 1.5px solid var(--cds-border-strong);
}
.org-tree__item:only-child::before,
.org-tree__item:only-child::after {
    display: none;
}
.org-tree__item:only-child {
    padding-top: 26px;
}
.org-tree__item:first-child::before,
.org-tree__item:last-child::after {
    border: 0 none;
}
.org-tree__item:last-child::before {
    border-right: 1.5px solid var(--cds-border-strong);
    border-radius: 0 6px 0 0;
}
.org-tree__item:first-child::after {
    border-radius: 6px 0 0 0;
}
.org-tree__item--root {
    padding-top: 0;
}
.org-tree__item--root::before,
.org-tree__item--root::after {
    display: none;
}

/* 자식 목록 */
.org-tree__children {
    display: flex;
    justify-content: center;
    padding: 26px 0 0;
    margin: 0;
    position: relative;
}
.org-tree__children::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    width: 0;
    height: 26px;
    border-left: 1.5px solid var(--cds-border-strong);
}
/* 자식이 하나뿐이면 li 의 padding-top 과 겹치지 않도록 */
.org-tree__children > .org-tree__item:only-child {
    padding-top: 0;
}

/* 부서 카드 */
.org-node {
    position: relative;
    width: 208px;
    min-height: 62px;
    background: var(--cds-surface-2);
    border: 1px solid var(--cds-border);
    border-radius: var(--cds-radius--lg);
    box-shadow: var(--cds-shadow-sm);
    padding: 10px 12px 10px;
    cursor: pointer;
    transition: box-shadow 0.16s var(--cds-ease-out), border-color 0.16s var(--cds-ease-out), transform 0.16s var(--cds-ease-out),
        opacity 0.16s var(--cds-ease-out);
    overflow: hidden;
}
.org-node:hover {
    border-color: var(--cds-border-strong);
    box-shadow: var(--cds-shadow-md);
    transform: translateY(-1px);
}
.org-node--root {
    width: 232px;
    background: var(--cds-surface-1);
}
.org-node--selected {
    border-color: rgb(var(--v-theme-primary));
    box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.22), var(--cds-shadow-md);
}
.org-node--drop-target {
    border-color: rgb(var(--v-theme-primary));
    background: rgba(var(--v-theme-primary), 0.06);
    border-style: dashed;
}
.org-node--dimmed {
    opacity: 0.32;
}
.org-node--matched {
    border-color: rgb(var(--v-theme-warning));
    box-shadow: 0 0 0 2px rgba(var(--v-theme-warning), 0.25);
}

/* 깊이별 상단 컬러 바 */
.org-node__bar {
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
    background: var(--org-accent, var(--cds-border-strong));
}
.org-node--depth-0 {
    --org-accent: rgb(var(--v-theme-primary));
}
.org-node--depth-1 {
    --org-accent: #3b82f6;
}
.org-node--depth-2 {
    --org-accent: #10b981;
}
.org-node--depth-3 {
    --org-accent: #f59e0b;
}
.org-node--depth-4 {
    --org-accent: #a855f7;
}

.org-node__head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
}
.org-node__icon {
    color: var(--org-accent);
    flex: none;
}
.org-node__name {
    flex: 1;
    min-width: 0;
    font-size: var(--cds-font-size-body);
    font-weight: var(--cds-font-weight-semibold);
    color: var(--cds-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
}
.org-node__chevron {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 999px;
    color: var(--cds-text-muted);
}
.org-node__chevron:hover {
    background: var(--cds-bg-neutral);
    color: var(--cds-text-primary);
}

.org-node__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    font-size: var(--cds-font-size-caption);
    color: var(--cds-text-muted);
    flex-wrap: wrap;
}
.org-node__stat {
    display: inline-flex;
    align-items: center;
    gap: 2px;
}
.org-node__leader {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--cds-text-secondary);
}

.org-node__members {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed var(--cds-border);
}
.org-member {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 4px;
    border-radius: var(--cds-radius--xs);
    cursor: pointer;
    transition: background 0.12s var(--cds-ease-out);
}
.org-member:hover {
    background: var(--cds-bg-neutral);
}
.org-member--selected {
    background: rgba(var(--v-theme-primary), 0.12);
}
.org-member--dimmed {
    opacity: 0.3;
}
.org-member--leader .org-member__name {
    font-weight: var(--cds-font-weight-semibold);
}
.org-member__avatar {
    flex: none;
    background: var(--cds-bg-neutral);
    color: var(--cds-text-muted);
}
.org-member__name {
    flex: 1;
    min-width: 0;
    font-size: var(--cds-font-size-caption);
    color: var(--cds-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
}
.org-member__badge {
    flex: none;
    color: var(--cds-text-muted);
}

.org-node__more {
    margin-top: 2px;
    font-size: var(--cds-font-size-caption);
    color: var(--cds-text-accent);
    text-align: left;
    padding: 0 4px;
}
.org-node__more:hover {
    text-decoration: underline;
}
.org-node__empty {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed var(--cds-border);
    font-size: var(--cds-font-size-caption);
    color: var(--cds-text-disabled);
    text-align: left;
}

.org-node__actions {
    display: none;
    position: absolute;
    top: 6px;
    right: 4px;
    background: var(--cds-surface-2);
    border-radius: 999px;
    box-shadow: var(--cds-shadow-sm);
}
.org-node:hover .org-node__actions {
    display: flex;
}

@media (max-width: 768px) {
    .org-node {
        width: 168px;
    }
    .org-node--root {
        width: 188px;
    }
}
</style>

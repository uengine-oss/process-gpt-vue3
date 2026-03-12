<template>
    <div class="org-flow-node" :class="{ matched: data.matchesSearch, selected: data.selected }">
        <Handle id="target" type="target" :position="Position.Top" class="org-flow-handle" />
        <div class="org-flow-card">
            <div class="org-flow-header">
                <div v-if="data.isRoot" class="org-flow-badge">ROOT</div>
                <div v-else-if="data.isTeam" class="org-flow-badge org-flow-badge-team">TEAM</div>
                <img
                    v-if="!data.isRoot && !data.isTeam"
                    class="org-flow-avatar"
                    :src="data.userData.profile || '/images/defaultUser.png'"
                    alt="profile"
                    @error="onImageError"
                />
                <div class="org-flow-spacer"></div>
            </div>
            <div class="org-flow-body">
                <div class="org-flow-name">{{ data.userData.username || data.userData.name || data.originalId }}</div>
                <div v-if="data.userData.email" class="org-flow-email">{{ data.userData.email }}</div>
                <div v-if="data.userData.role" class="org-flow-role">{{ data.userData.role }}</div>
            </div>
            <div class="org-flow-actions">
                <button
                    v-if="data.isRoot"
                    type="button"
                    class="org-flow-action org-flow-action-primary"
                    title="Add Team"
                    aria-label="Add Team"
                    @click.stop="runAction('addTeam')"
                >
                    <span aria-hidden="true">+</span>
                </button>
                <template v-else-if="data.isTeam">
                    <button
                        type="button"
                        class="org-flow-action org-flow-action-primary"
                        title="Add Member"
                        aria-label="Add Member"
                        @click.stop="runAction('addMember')"
                    >
                        <span aria-hidden="true">+</span>
                    </button>
                    <button
                        type="button"
                        class="org-flow-action"
                        title="Edit Team"
                        aria-label="Edit Team"
                        @click.stop="runAction('editTeam')"
                    >
                        <span aria-hidden="true">✎</span>
                    </button>
                    <button
                        type="button"
                        class="org-flow-action org-flow-action-danger"
                        title="Delete Team"
                        aria-label="Delete Team"
                        @click.stop="runAction('deleteTeam')"
                    >
                        <span aria-hidden="true">×</span>
                    </button>
                </template>
                <template v-else>
                    <button
                        type="button"
                        class="org-flow-action"
                        :title="data.isAgent ? 'Edit Agent' : 'Edit User'"
                        :aria-label="data.isAgent ? 'Edit Agent' : 'Edit User'"
                        @click.stop="runAction(data.isAgent ? 'editAgent' : 'editUser')"
                    >
                        <span aria-hidden="true">✎</span>
                    </button>
                    <button
                        v-if="data.isAgent"
                        type="button"
                        class="org-flow-action org-flow-action-danger"
                        title="Delete Agent"
                        aria-label="Delete Agent"
                        @click.stop="runAction('deleteAgent')"
                    >
                        <span aria-hidden="true">×</span>
                    </button>
                </template>
            </div>
        </div>
        <Handle id="source" type="source" :position="Position.Bottom" class="org-flow-handle" />
    </div>
</template>

<script setup>
import { Handle, Position } from '@vue-flow/core';

const props = defineProps({
    data: {
        type: Object,
        required: true
    }
});

function onImageError(event) {
    event.target.src = '/images/defaultUser.png';
}

function runAction(actionName) {
    const action = actionName ? props.data?.[actionName] : null;
    if (typeof action === 'function') {
        action();
    }
}
</script>

<style scoped>
.org-flow-node {
    width: 220px;
}

.org-flow-handle {
    opacity: 0;
    width: 10px;
    height: 10px;
    pointer-events: none;
}

.org-flow-card {
    border-radius: 18px;
    border: 1px solid rgba(15, 23, 42, 0.12);
    background: #fff;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
    overflow: hidden;
}

.org-flow-node.matched .org-flow-card {
    border-color: rgb(var(--v-theme-primary));
    box-shadow: 0 16px 36px rgba(var(--v-theme-primary), 0.18);
}

.org-flow-node.selected .org-flow-card {
    box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.2);
}

.org-flow-header {
    display: flex;
    align-items: center;
    min-height: 28px;
    padding: 12px 14px 0;
    gap: 8px;
}

.org-flow-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 46px;
    height: 24px;
    padding: 0 10px;
    border-radius: 999px;
    background: #dbeafe;
    color: #1d4ed8;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
}

.org-flow-badge-team {
    background: #dcfce7;
    color: #166534;
}

.org-flow-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
}

.org-flow-spacer {
    flex: 1;
}

.org-flow-body {
    width: 100%;
    padding: 10px 14px 14px;
    text-align: left;
    background: transparent;
    border: 0;
    cursor: pointer;
}

.org-flow-name {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
}

.org-flow-email {
    margin-top: 4px;
    font-size: 12px;
    color: #475569;
}

.org-flow-role {
    margin-top: 4px;
    font-size: 11px;
    color: #64748b;
}

.org-flow-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0 14px 14px;
}

.org-flow-action {
    border: 0;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: #e2e8f0;
    color: #0f172a;
    font-size: 16px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
}

.org-flow-action-primary {
    background: #2563eb;
    color: #fff;
}

.org-flow-action-danger {
    background: #dc2626;
    color: #fff;
}
</style>

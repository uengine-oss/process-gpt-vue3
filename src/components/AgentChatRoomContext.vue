<template>
    <div v-if="hasSideInfo" class="side-info">
        <details v-if="showActivityBlock" class="side-info__box" open>
            <summary class="side-info__summary">
                <span class="side-info__title">활동</span>
                <span class="side-info__count">{{ activityList.length }}</span>
            </summary>
            <ul class="side-info__list side-info__list--scroll">
                <li
                    v-for="a in activityList"
                    :key="a.key"
                    class="side-info__item activity-item"
                    :class="{ 'is-nested': a.depth > 0 }"
                    :style="{ '--activity-depth': a.depth }"
                >
                    <span class="side-info__item-label activity-row">
                        <span v-if="a.depth > 0" class="activity-indent" aria-hidden="true">↳</span>
                        <v-icon
                            size="14"
                            class="activity-icon"
                            :color="a.kind === 'subagent' ? 'primary' : undefined"
                        >
                            {{ a.kind === 'subagent' ? 'mdi-robot-outline' : 'mdi-wrench-outline' }}
                        </v-icon>
                        <span class="activity-kind" :class="`is-${a.kind}`">
                            {{ a.kind === 'subagent' ? '서브에이전트' : '도구' }}
                        </span>
                        <strong v-if="a.kind === 'subagent'" class="activity-name">
                            {{ a.subagentType || 'subagent' }}
                        </strong>
                        <span v-else class="activity-name">{{ a.label }}</span>
                    </span>
                    <span class="side-info__chip" :class="`is-${a.status || 'running'}`">{{ a.status || 'running' }}</span>
                </li>
            </ul>
        </details>

        <details v-if="showKnowledgeBlock" class="side-info__box" open>
            <summary class="side-info__summary">
                <span class="side-info__title">지식 베이스</span>
                <span class="side-info__count">{{ knowledgeList.length }}</span>
            </summary>
            <ul class="side-info__list">
                <li v-for="d in knowledgeList" :key="d.key" class="side-info__item">
                    <span class="side-info__item-label">{{ d.label }}</span>
                    <span v-if="d.source" class="side-info__chip" :class="`is-${d.source}`">
                        {{ d.source === 'drive' ? 'Drive' : 'Storage' }}
                    </span>
                </li>
            </ul>
        </details>

        <details v-if="showAttachmentsBlock" class="side-info__box" :open="!showKnowledgeBlock">
            <summary class="side-info__summary">
                <span class="side-info__title">업로드</span>
                <span class="side-info__count">{{ attachmentsList.length }}</span>
            </summary>
            <ul class="side-info__list">
                <li v-for="a in attachmentsList" :key="a.key" class="side-info__item">
                    <span class="side-info__item-label">{{ a.label }}</span>
                </li>
            </ul>
        </details>

        <details v-if="showTodosBlock" class="side-info__box" :open="!showAttachmentsBlock">
            <summary class="side-info__summary">
                <span class="side-info__title">{{ $t('AgentChatRoomContext.progress') }}</span>
                <span class="side-info__count">{{ todosList.length }}</span>
            </summary>
            <ul class="side-info__list">
                <li v-for="td in todosList" :key="td.key" class="side-info__item">
                    <span class="side-info__item-label">{{ td.label }}</span>
                    <span v-if="td.status" class="side-info__chip" :class="`is-${td.status}`">{{ td.status }}</span>
                </li>
            </ul>
        </details>

        <details v-if="showContextBlock" class="side-info__box" :open="!showAttachmentsBlock && !showTodosBlock">
            <summary class="side-info__summary">
                <span class="side-info__title">{{ $t('AgentChatRoomContext.context') }}</span>
            </summary>
            <div class="side-info__nested">
                <details v-if="showSkillsBlock" class="side-info__sub-box" open>
                    <summary class="side-info__sub-summary">
                        <span class="side-info__sub-title">{{ $t('AgentChatRoomContext.skills') }}</span>
                    </summary>
                    <ul class="side-info__list">
                        <li v-for="s in skillsList" :key="s.key" class="side-info__item">{{ s.label }}</li>
                    </ul>
                </details>
                <details v-if="showConnectorsBlock" class="side-info__sub-box" open>
                    <summary class="side-info__sub-summary">
                        <span class="side-info__sub-title">{{ $t('AgentChatRoomContext.connectors') }}</span>
                    </summary>
                    <ul class="side-info__list">
                        <li v-for="c in connectorsList" :key="c.key" class="side-info__item">{{ c.label }}</li>
                    </ul>
                </details>
            </div>
        </details>

    </div>
</template>

<script>
/** 에이전트 채팅방 컨텍스트(할일·스킬·도구 등) — 아티팩트 탭과 구분되는 패널 타입. ArtifactPanel 등에서 import */
export const AGENT_CHAT_ROOM_CONTEXT_TYPES = new Set(['activity', 'attachments', 'tools', 'skills', 'todos', 'knowledge', 'connectors']);

export default {
    name: 'AgentChatRoomContext',
    props: {
        panels: { type: Array, default: () => [] }
    },
    computed: {
        sideInfoPanels() {
            const ps = Array.isArray(this.panels) ? this.panels : [];
            const map = new Map();
            ps.forEach((p) => {
                if (p && AGENT_CHAT_ROOM_CONTEXT_TYPES.has(p.type)) map.set(p.type, p);
            });
            return map;
        },
        activityList() {
            const p = this.sideInfoPanels.get('activity');
            const items = Array.isArray(p?.data?.items) ? p.data.items : [];
            return items
                .map((it, idx) => {
                    const kind = (it?.kind || (it?.tool === 'task' ? 'subagent' : 'tool')).toString();
                    const subagentType = (it?.subagentType || it?.subagent_type || '').toString();
                    const parentSubagent = (it?.parentSubagent || it?.parent_subagent || '').toString();
                    const rawDepth = Number(it?.depth);
                    const depth = Number.isFinite(rawDepth) && rawDepth > 0 ? rawDepth : 0;
                    const baseLabel =
                        kind === 'subagent'
                            ? subagentType || 'subagent'
                            : (it?.displayName || it?.name || it?.tool || '').toString();
                    return {
                        key: (it?.id || `act-${idx}`).toString(),
                        label: baseLabel,
                        kind,
                        subagentType,
                        parentSubagent,
                        depth,
                        status: (it?.status || 'running').toString()
                    };
                })
                .filter((x) => x.label);
        },
        attachmentsList() {
            const p = this.sideInfoPanels.get('attachments');
            const items = Array.isArray(p?.data?.items) ? p.data.items : [];
            return items
                .map((a, idx) => {
                    const label = (a?.file_name || a?.fileName || a?.name || a?.label || '').toString().trim();
                    return {
                        key: (a?.id || `att-${idx}`).toString(),
                        label: label || (a?.file_path || a?.fileUrl || a?.url || a?.path || `첨부 ${idx + 1}`).toString()
                    };
                })
                .filter((x) => x.label);
        },
        knowledgeList() {
            const p = this.sideInfoPanels.get('knowledge');
            const items = Array.isArray(p?.data?.items) ? p.data.items : [];
            return items
                .map((d, idx) => ({
                    key: (d?.id || d?.sourceRef || d?.source_ref || `knw-${idx}`).toString(),
                    label: (d?.name || d?.file_name || d?.label || '').toString(),
                    source: (d?.sourceType || d?.source_type || '').toString()
                }))
                .filter((x) => x.label);
        },
        skillsList() {
            const p = this.sideInfoPanels.get('skills');
            const items = Array.isArray(p?.data?.items) ? p.data.items : [];
            const list = items
                .map((s, idx) => ({
                    key: (s?.id || s?.name || `skill-${idx}`).toString(),
                    label: (s?.name || s?.label || s?.skill || '').toString()
                }))
                .filter((x) => x.label);
            const seen = new Set();
            return list.filter((x) => {
                const k = x.label.trim();
                if (!k) return false;
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
            });
        },
        connectorsList() {
            const p = this.sideInfoPanels.get('connectors');
            const items = Array.isArray(p?.data?.items) ? p.data.items : [];
            const list = items
                .map((c, idx) => ({
                    key: (c?.id || c?.name || `conn-${idx}`).toString(),
                    label: (c?.name || c?.label || c?.connector || '').toString()
                }))
                .filter((x) => x.label);
            const seen = new Set();
            return list.filter((x) => {
                const k = x.label.trim();
                if (!k) return false;
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
            });
        },
        todosList() {
            const p = this.sideInfoPanels.get('todos');
            const items = Array.isArray(p?.data?.items) ? p.data.items : [];
            return items
                .map((td, idx) => ({
                    key: (td?.id || td?.name || `todo-${idx}`).toString(),
                    label: (td?.content || td?.name || td?.label || td?.title || '').toString(),
                    status: (td?.status || '').toString()
                }))
                .filter((x) => x.label);
        },
        showActivityBlock() {
            // Claude Desktop식: 활동(도구 사용)은 우측이 아니라 채팅 메시지 하단 인라인으로 표시한다.
            return false;
        },
        showKnowledgeBlock() {
            return this.knowledgeEnabled && this.knowledgeList.length > 0;
        },
        showAttachmentsBlock() {
            return this.attachmentsEnabled && this.attachmentsList.length > 0;
        },
        showTodosBlock() {
            return this.todosEnabled && this.todosList.length > 0;
        },
        showSkillsBlock() {
            return this.skillsEnabled && this.skillsList.length > 0;
        },
        showConnectorsBlock() {
            return this.connectorsEnabled && this.connectorsList.length > 0;
        },
        showContextBlock() {
            return this.showSkillsBlock || this.showConnectorsBlock;
        },
        hasSideInfo() {
            return (
                this.showActivityBlock ||
                this.showKnowledgeBlock ||
                this.showAttachmentsBlock ||
                this.showTodosBlock ||
                this.showContextBlock
            );
        },
        activityEnabled() {
            return !!this.sideInfoPanels.get('activity')?.data?.enabled;
        },
        knowledgeEnabled() {
            return !!this.sideInfoPanels.get('knowledge')?.data?.enabled;
        },
        attachmentsEnabled() {
            return !!this.sideInfoPanels.get('attachments')?.data?.enabled;
        },
        skillsEnabled() {
            return !!this.sideInfoPanels.get('skills')?.data?.enabled;
        },
        todosEnabled() {
            return !!this.sideInfoPanels.get('todos')?.data?.enabled;
        },
        connectorsEnabled() {
            return !!this.sideInfoPanels.get('connectors')?.data?.enabled;
        }
    }
};
</script>

<style scoped>
.side-info {
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-bottom: 1px solid rgba(var(--v-theme-borderColor), 0.5);
}

.side-info__box {
    border: 1px solid rgba(var(--v-theme-borderColor), 0.55);
    border-radius: 12px;
    padding: 8px 10px;
    background: rgba(var(--v-theme-on-surface), 0.02);
}

.side-info__summary {
    list-style: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    cursor: pointer;
    user-select: none;
}

.side-info__summary::-webkit-details-marker {
    display: none;
}

.side-info__title {
    font-size: 12px;
    font-weight: 700;
    color: rgba(var(--v-theme-on-surface), 0.85);
}

.side-info__count {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid rgba(var(--v-theme-borderColor), 0.6);
    color: rgba(var(--v-theme-on-surface), 0.55);
    background: rgba(var(--v-theme-on-surface), 0.03);
}

.side-info__list {
    margin: 8px 0 0 0;
    padding-left: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

/* 활동처럼 끝없이 길어질 수 있는 리스트는 자체 스크롤 */
.side-info__list--scroll {
    max-height: 360px;
    overflow-y: auto;
    /* 스크롤바가 들여쓰기와 겹치지 않게 약간의 우측 여유 */
    padding-right: 4px;
    /* 얇은 스크롤바 (Firefox) */
    scrollbar-width: thin;
}

.side-info__list--scroll::-webkit-scrollbar {
    width: 6px;
}
.side-info__list--scroll::-webkit-scrollbar-thumb {
    background: rgba(var(--v-theme-on-surface), 0.18);
    border-radius: 3px;
}
.side-info__list--scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(var(--v-theme-on-surface), 0.3);
}

.side-info__item {
    font-size: 11px;
    color: rgba(var(--v-theme-on-surface), 0.7);
    word-break: break-word;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
}

.side-info__item-label {
    flex: 1;
    min-width: 0;
}

.side-info__chip {
    flex-shrink: 0;
    font-size: 10px;
    line-height: 1;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid rgba(var(--v-theme-borderColor), 0.6);
    color: rgba(var(--v-theme-on-surface), 0.6);
    background: rgba(var(--v-theme-on-surface), 0.03);
    text-transform: lowercase;
}

.side-info__chip.is-running,
.side-info__chip.is-in_progress {
    border-color: rgba(var(--v-theme-primary), 0.4);
    color: rgb(var(--v-theme-primary));
    background: rgba(var(--v-theme-primary), 0.08);
}

.side-info__chip.is-done,
.side-info__chip.is-completed {
    border-color: rgba(var(--v-theme-success), 0.35);
    color: rgb(var(--v-theme-success));
    background: rgba(var(--v-theme-success), 0.08);
}

.side-info__chip.is-planned,
.side-info__chip.is-pending {
    border-color: rgba(var(--v-theme-info), 0.35);
    color: rgb(var(--v-theme-info));
    background: rgba(var(--v-theme-info), 0.08);
}

.side-info__chip.is-error,
.side-info__chip.is-failed {
    border-color: rgba(var(--v-theme-error), 0.4);
    color: rgb(var(--v-theme-error));
    background: rgba(var(--v-theme-error), 0.08);
}

.side-info__nested {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.side-info__sub-box {
    padding: 6px 0;
    border: none;
    border-radius: 0;
    background: transparent;
}

.side-info__sub-box .side-info__list {
    padding-left: 0px;
}

.side-info__sub-summary {
    list-style: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    cursor: pointer;
    user-select: none;
}

.side-info__sub-summary::-webkit-details-marker {
    display: none;
}

.side-info__sub-title {
    font-size: 11px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.75);
}

.activity-row {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
}

.activity-icon {
    flex-shrink: 0;
}

.activity-kind {
    font-size: 10px;
    line-height: 1;
    padding: 2px 6px;
    border-radius: 999px;
    border: 1px solid rgba(var(--v-theme-borderColor), 0.55);
    color: rgba(var(--v-theme-on-surface), 0.6);
    background: rgba(var(--v-theme-on-surface), 0.03);
    flex-shrink: 0;
}

.activity-kind.is-subagent {
    border-color: rgba(var(--v-theme-primary), 0.4);
    color: rgb(var(--v-theme-primary));
    background: rgba(var(--v-theme-primary), 0.08);
}

.activity-name {
    word-break: break-all;
    min-width: 0;
}

.activity-item.is-nested {
    padding-left: calc(var(--activity-depth, 0) * 14px);
    position: relative;
}

.activity-indent {
    color: rgba(var(--v-theme-on-surface), 0.4);
    font-size: 11px;
    line-height: 1;
    margin-right: 2px;
    flex-shrink: 0;
}
</style>

<template>
    <div v-if="hasSideInfo" class="side-info">
        <details v-if="showAttachmentsBlock" class="side-info__box" open>
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
                <span class="side-info__title">To-dos</span>
                <span class="side-info__count">{{ todosList.length }}</span>
            </summary>
            <ul class="side-info__list">
                <li v-for="td in todosList" :key="td.key" class="side-info__item">
                    <span class="side-info__item-label">{{ td.label }}</span>
                    <span v-if="td.status" class="side-info__chip" :class="`is-${td.status}`">{{ td.status }}</span>
                </li>
            </ul>
        </details>

        <details v-if="showSkillsBlock" class="side-info__box" :open="!showAttachmentsBlock && !showTodosBlock">
            <summary class="side-info__summary">
                <span class="side-info__title">스킬</span>
                <span class="side-info__count">{{ skillsList.length }}</span>
            </summary>
            <ul class="side-info__list">
                <li v-for="s in skillsList" :key="s.key" class="side-info__item">{{ s.label }}</li>
            </ul>
        </details>

        <details v-if="showToolsBlock" class="side-info__box" :open="!showAttachmentsBlock && !showTodosBlock && !showSkillsBlock">
            <summary class="side-info__summary">
                <span class="side-info__title">도구</span>
                <span class="side-info__count">{{ toolsList.length }}</span>
            </summary>
            <ul class="side-info__list">
                <li v-for="t in toolsList" :key="t.key" class="side-info__item">
                    <span class="side-info__item-label">{{ t.label }}</span>
                </li>
            </ul>
        </details>
    </div>
</template>

<script>
/** 에이전트 채팅방 컨텍스트(할일·스킬·도구 등) — 아티팩트 탭과 구분되는 패널 타입. ArtifactPanel 등에서 import */
export const AGENT_CHAT_ROOM_CONTEXT_TYPES = new Set(['attachments', 'tools', 'skills', 'todos']);

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
        toolsList() {
            const p = this.sideInfoPanels.get('tools');
            const items = Array.isArray(p?.data?.items) ? p.data.items : [];
            const list = items
                .map((t, idx) => ({
                    key: (t?.id || t?.name || t?.tool || `tool-${idx}`).toString(),
                    label: (t?.displayName || t?.name || t?.tool || '').toString()
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
        showAttachmentsBlock() {
            return this.attachmentsEnabled && this.attachmentsList.length > 0;
        },
        showTodosBlock() {
            return this.todosEnabled && this.todosList.length > 0;
        },
        showSkillsBlock() {
            return this.skillsEnabled && this.skillsList.length > 0;
        },
        showToolsBlock() {
            return this.toolsEnabled && this.toolsList.length > 0;
        },
        hasSideInfo() {
            return (
                this.showAttachmentsBlock ||
                this.showTodosBlock ||
                this.showSkillsBlock ||
                this.showToolsBlock
            );
        },
        attachmentsEnabled() {
            return !!this.sideInfoPanels.get('attachments')?.data?.enabled;
        },
        toolsEnabled() {
            return !!this.sideInfoPanels.get('tools')?.data?.enabled;
        },
        skillsEnabled() {
            return !!this.sideInfoPanels.get('skills')?.data?.enabled;
        },
        todosEnabled() {
            return !!this.sideInfoPanels.get('todos')?.data?.enabled;
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
</style>

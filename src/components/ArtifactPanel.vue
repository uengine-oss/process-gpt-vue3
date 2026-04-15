<template>
    <div class="artifact-panel">
        <!-- Tab bar -->
        <div class="artifact-panel__tab-bar">
            <div class="artifact-panel__tabs-scroll">
                <button
                    v-for="panel in tabPanels"
                    :key="panel.id"
                    class="artifact-panel__tab"
                    :class="{ 'is-active': panel.id === activeId }"
                    @click="$emit('update:activeId', panel.id)"
                >
                    <v-icon size="13" class="artifact-panel__tab-icon">{{ typeIcon(panel.type) }}</v-icon>
                    <span class="artifact-panel__tab-label">{{ panel.label }}</span>
                    <span class="artifact-panel__tab-close" @click.stop="$emit('close-panel', panel.id)">
                        <v-icon size="11">mdi-close</v-icon>
                    </span>
                </button>
            </div>
            <v-btn icon variant="text" density="comfortable" size="small" class="artifact-panel__close-btn" @click="$emit('close')">
                <v-icon size="16">mdi-close</v-icon>
            </v-btn>
        </div>

        <!-- Panel bodies: all mounted (v-show), only active is visible -->
        <div class="artifact-panel__body">
            <!-- Expandable side info boxes (tools/skills/todos) -->
            <div v-if="hasSideInfo" class="side-info">
                <details v-if="todosEnabled" class="side-info__box" open>
                    <summary class="side-info__summary">
                        <span class="side-info__title">To-dos</span>
                        <span class="side-info__count">{{ todosList.length }}</span>
                    </summary>
                    <div v-if="todosList.length === 0" class="side-info__empty">표시할 할일이 없습니다.</div>
                    <ul v-else class="side-info__list">
                        <li v-for="td in todosList" :key="td.key" class="side-info__item">
                            <span class="side-info__item-label">{{ td.label }}</span>
                            <span v-if="td.status" class="side-info__chip" :class="`is-${td.status}`">{{ td.status }}</span>
                        </li>
                    </ul>
                </details>

                <details v-if="skillsEnabled" class="side-info__box">
                    <summary class="side-info__summary">
                        <span class="side-info__title">스킬</span>
                        <span class="side-info__count">{{ skillsList.length }}</span>
                    </summary>
                    <div v-if="skillsList.length === 0" class="side-info__empty">표시할 스킬이 없습니다.</div>
                    <ul v-else class="side-info__list">
                        <li v-for="s in skillsList" :key="s.key" class="side-info__item">{{ s.label }}</li>
                    </ul>
                </details>

                <details v-if="toolsEnabled" class="side-info__box">
                    <summary class="side-info__summary">
                        <span class="side-info__title">도구</span>
                        <span class="side-info__count">{{ toolsList.length }}</span>
                    </summary>
                    <div v-if="toolsList.length === 0" class="side-info__empty">표시할 도구가 없습니다.</div>
                    <ul v-else class="side-info__list">
                        <li v-for="t in toolsList" :key="t.key" class="side-info__item">
                            <span class="side-info__item-label">{{ t.label }}</span>
                        </li>
                    </ul>
                </details>
            </div>

            <template v-for="panel in tabPanels" :key="panel.id">
                <div v-show="panel.id === activeId" class="artifact-panel__content">
                    <!-- HWPX 문서 미리보기 -->
                    <HwpxViewer
                        v-if="panel.type === 'hwpx'"
                        :ref="(el) => setPanelRef(panel.id, el)"
                        :htmlUrl="panel.data.htmlUrl"
                        @close="$emit('close-panel', panel.id)"
                        @download="emitPanelAction(panel, 'download', $event)"
                        @page-edit-request="emitPanelAction(panel, 'page-edit-request', $event)"
                    />
                    <!-- DOCX 문서 미리보기 -->
                    <HwpxViewer
                        v-else-if="panel.type === 'docx'"
                        :ref="(el) => setPanelRef(panel.id, el)"
                        :htmlUrl="panel.data.htmlUrl"
                        @close="$emit('close-panel', panel.id)"
                        @download="emitPanelAction(panel, 'download', $event)"
                        @page-edit-request="emitPanelAction(panel, 'page-edit-request', $event)"
                    />
                    <!-- 슬라이드 미리보기 -->
                    <SlideArtifactViewer
                        v-else-if="panel.type === 'slide'"
                        :ref="(el) => setPanelRef(panel.id, el)"
                        :slideMarkdown="panel.data.slideMarkdown"
                        :imageUrls="panel.data.imageUrls || []"
                    />
                    <!-- 새 패널 타입은 여기에 v-else-if로 추가 -->
                </div>
            </template>
        </div>
    </div>
</template>

<script>
import HwpxViewer from '@/components/HwpxViewer.vue';
import SlideArtifactViewer from '@/components/SlideArtifactViewer.vue';

// 패널 타입별 아이콘 레지스트리 — 새 타입 추가 시 여기만 수정
const PANEL_TYPE_ICONS = {
    hwpx: 'mdi-file-document-outline',
    docx: 'mdi-file-word-outline',
    slide: 'mdi-presentation',
    tools: 'mdi-tools'
};

const SIDE_INFO_TYPES = new Set(['tools', 'skills', 'todos']);

export default {
    name: 'ArtifactPanel',
    components: { HwpxViewer, SlideArtifactViewer },
    props: {
        panels: { type: Array, default: () => [] },
        activeId: { type: String, default: null }
    },
    emits: ['update:activeId', 'close', 'close-panel', 'panel-action'],
    data() {
        return {
            panelRefs: {}
        };
    },
    computed: {
        tabPanels() {
            const ps = Array.isArray(this.panels) ? this.panels : [];
            return ps.filter((p) => p && !SIDE_INFO_TYPES.has(p.type));
        },
        sideInfoPanels() {
            const ps = Array.isArray(this.panels) ? this.panels : [];
            const map = new Map();
            ps.forEach((p) => {
                if (p && SIDE_INFO_TYPES.has(p.type)) map.set(p.type, p);
            });
            return map;
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
            // 표시용 중복 제거(같은 이름은 1번만)
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
            // 표시용 중복 제거(같은 이름은 1번만)
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
        hasSideInfo() {
            return this.toolsEnabled || this.skillsEnabled || this.todosEnabled;
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
    },
    methods: {
        typeIcon(type) {
            return PANEL_TYPE_ICONS[type] || 'mdi-file-outline';
        },
        setPanelRef(panelId, el) {
            if (el) {
                this.panelRefs[panelId] = el;
            } else {
                delete this.panelRefs[panelId];
            }
        },
        /** 특정 패널의 내부 뷰어 컴포넌트 인스턴스 반환 */
        getViewer(panelId) {
            return this.panelRefs[panelId] || null;
        },
        /** 내부 뷰어의 메서드를 외부에서 호출할 수 있도록 위임 */
        callPanelMethod(panelId, method, ...args) {
            const viewer = this.getViewer(panelId);
            if (viewer && typeof viewer[method] === 'function') {
                return viewer[method](...args);
            }
        },
        emitPanelAction(panel, action, payload) {
            this.$emit('panel-action', {
                type: panel.type,
                action,
                panelId: panel.id,
                payload
            });
        },
    }
};
</script>

<style scoped>
.artifact-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.artifact-panel__tab-bar {
    display: flex;
    align-items: center;
    border-bottom: 1px solid rgba(var(--v-theme-borderColor), 0.7);
    padding: 0 8px 0 0;
    min-height: 40px;
    gap: 4px;
    flex-shrink: 0;
}

.artifact-panel__tabs-scroll {
    display: flex;
    flex: 1;
    overflow-x: auto;
    scrollbar-width: none;
    gap: 2px;
    padding: 4px 4px 0 4px;
    align-items: flex-end;
}

.artifact-panel__tabs-scroll::-webkit-scrollbar {
    display: none;
}

.artifact-panel__tab {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    border-radius: 6px 6px 0 0;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.55);
    white-space: nowrap;
    transition: background 0.15s, color 0.15s;
    max-width: 220px;
}

.artifact-panel__tab:hover {
    background: rgba(var(--v-theme-on-surface), 0.06);
    color: rgba(var(--v-theme-on-surface), 0.85);
}

.artifact-panel__tab.is-active {
    background: rgba(var(--v-theme-primary), 0.1);
    color: rgb(var(--v-theme-primary));
    font-weight: 500;
}

.artifact-panel__tab-label {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 150px;
}

.artifact-panel__tab-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 3px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s, background 0.15s;
}

.artifact-panel__tab:hover .artifact-panel__tab-close,
.artifact-panel__tab.is-active .artifact-panel__tab-close {
    opacity: 0.6;
}

.artifact-panel__tab-close:hover {
    background: rgba(var(--v-theme-on-surface), 0.12);
    opacity: 1 !important;
}

.artifact-panel__close-btn {
    flex-shrink: 0;
}

.artifact-panel__body {
    flex: 1;
    min-height: 0;
    position: relative;
}

.artifact-panel__content {
    height: 100%;
}

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

.side-info__empty {
    font-size: 11px;
    margin-top: 8px;
    color: rgba(var(--v-theme-on-surface), 0.6);
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

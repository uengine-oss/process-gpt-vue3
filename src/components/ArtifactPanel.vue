<template>
    <div class="artifact-panel">
        <!-- Tab bar -->
        <div class="artifact-panel__tab-bar">
            <div class="artifact-panel__tabs-scroll">
                <!-- 컨텍스트(활동/지식 등) — 미리보기와 상호배타. 같이 보여도 되는 정보 묶음 -->
                <button
                    v-if="hasContext"
                    class="artifact-panel__tab"
                    :class="{ 'is-active': showContext }"
                    @click="selectContext"
                >
                    <v-icon size="13" class="artifact-panel__tab-icon">mdi-pulse</v-icon>
                    <span class="artifact-panel__tab-label">활동</span>
                </button>
                <!-- 미리보기 탭들 — 선택 시 *딱 그것만* 보임 -->
                <button
                    v-for="panel in tabPanels"
                    :key="panel.id"
                    class="artifact-panel__tab"
                    :class="{ 'is-active': !showContext && panel.id === activeId }"
                    @click="selectPreview(panel.id)"
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
            <!-- 컨텍스트는 미리보기 활성 시 숨김 → 미리보기 단독 표시 -->
            <AgentChatRoomContext v-if="showContext" :panels="panels" />

            <template v-for="panel in tabPanels" :key="panel.id">
                <div v-show="!showContext && panel.id === activeId" class="artifact-panel__content">
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
                    <!-- Markdown 문서 미리보기 (NDA 검토 비교표 등) -->
                    <MarkdownViewer
                        v-else-if="panel.type === 'markdown'"
                        :ref="(el) => setPanelRef(panel.id, el)"
                        :markdownContent="panel.data.markdownContent"
                        :fileUrl="panel.data.fileUrl"
                        :fileName="panel.data.fileName || panel.label"
                        @close="$emit('close-panel', panel.id)"
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
import MarkdownViewer from '@/components/MarkdownViewer.vue';
import AgentChatRoomContext, { AGENT_CHAT_ROOM_CONTEXT_TYPES } from '@/components/AgentChatRoomContext.vue';

// 패널 타입별 아이콘 레지스트리 — 새 타입 추가 시 여기만 수정
const PANEL_TYPE_ICONS = {
    hwpx: 'mdi-file-document-outline',
    docx: 'mdi-file-word-outline',
    slide: 'mdi-presentation',
    markdown: 'mdi-language-markdown-outline',
    tools: 'mdi-tools',
    attachments: 'mdi-paperclip'
};

export default {
    name: 'ArtifactPanel',
    components: { HwpxViewer, SlideArtifactViewer, MarkdownViewer, AgentChatRoomContext },
    props: {
        panels: { type: Array, default: () => [] },
        activeId: { type: String, default: null }
    },
    emits: ['update:activeId', 'close', 'close-panel', 'panel-action'],
    data() {
        return {
            panelRefs: {},
            // 미리보기를 보다 '활동' 탭을 누르면 true → 컨텍스트(활동/지식)만 표시
            forceContext: false
        };
    },
    computed: {
        tabPanels() {
            const ps = Array.isArray(this.panels) ? this.panels : [];
            return ps.filter((p) => p && !AGENT_CHAT_ROOM_CONTEXT_TYPES.has(p.type));
        },
        // 활동/지식 등 컨텍스트 패널 존재 여부
        hasContext() {
            const ps = Array.isArray(this.panels) ? this.panels : [];
            return ps.some((p) => p && AGENT_CHAT_ROOM_CONTEXT_TYPES.has(p.type));
        },
        // 현재 활성 탭이 미리보기(docx/markdown/slide/hwpx)인가
        isPreviewActive() {
            return this.tabPanels.some((p) => p.id === this.activeId);
        },
        // 컨텍스트(활동/지식)를 보여줄지 — true 면 미리보기 숨김(상호배타)
        showContext() {
            return (this.hasContext && this.forceContext) || !this.isPreviewActive;
        }
    },
    watch: {
        // 새 미리보기가 열리거나 다른 미리보기로 바뀌면 자동으로 미리보기 화면으로 전환
        activeId() {
            this.forceContext = false;
        }
    },
    methods: {
        // '활동' 탭 — 컨텍스트(활동/지식 등)만 표시
        selectContext() {
            this.forceContext = true;
        },
        // 미리보기 탭 — 그 미리보기만 단독 표시
        selectPreview(id) {
            this.forceContext = false;
            this.$emit('update:activeId', id);
        },
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
    overflow-y: auto;
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
</style>

<template>
    <div class="artifact-panel">
        <!-- Tab bar -->
        <div class="artifact-panel__tab-bar">
            <div class="artifact-panel__tabs-scroll">
                <button
                    v-for="panel in panels"
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
            <template v-for="panel in panels" :key="panel.id">
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
    slide: 'mdi-presentation'
};

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
        }
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

</style>

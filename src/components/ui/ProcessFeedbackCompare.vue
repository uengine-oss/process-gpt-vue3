<template>
    <div class="compare-root">
        <div class="compare-header">
            <v-icon size="20" class="mr-2">mdi-file-compare</v-icon>
            <span class="text-subtitle-1 font-weight-bold">{{ $t('ProcessFeedbackCompare.title') }}</span>
            <span v-if="summary" class="compare-summary text-truncate">{{ summary }}</span>
            <v-spacer />
            <span class="compare-selection-count">
                {{ $t('ProcessFeedbackCompare.selectedCount', { selected: selectedIds.size, total: changes.length }) }}
            </span>
            <v-btn variant="text" class="ml-3" @click="cancel">
                {{ $t('Common.cancel') }}
            </v-btn>
            <v-btn
                color="primary"
                variant="elevated"
                class="rounded-pill ml-2"
                :disabled="selectedIds.size === 0 || isApplying"
                :loading="isApplying"
                @click="apply"
            >
                {{ $t('ProcessFeedbackCompare.applyButton') }}
            </v-btn>
        </div>

        <v-alert v-if="mergeError" type="error" variant="tonal" density="compact" closable class="mx-4 mt-2" @click:close="mergeError = null">
            {{ $t('ProcessFeedbackCompare.mergeError') }}
            <div class="text-caption mt-1">{{ mergeError }}</div>
        </v-alert>

        <div class="compare-body">
            <div class="compare-panel">
                <div class="compare-panel-bar">
                    <span class="compare-badge badge-before">{{ $t('ProcessFeedbackCompare.before') }}</span>
                </div>
                <div class="compare-canvas">
                    <BpmnUengineViewer
                        v-if="beforeXml"
                        ref="viewerBefore"
                        :bpmn="beforeXml"
                        :diffActivities="diffActivitiesB"
                        :disable-auto-orientation="true"
                        @rendered="onBeforeRendered"
                    />
                </div>
            </div>

            <v-divider vertical />

            <div class="compare-panel">
                <div class="compare-panel-bar">
                    <span class="compare-badge badge-after">{{ $t('ProcessFeedbackCompare.after') }}</span>
                </div>
                <div class="compare-canvas">
                    <BpmnUengineViewer
                        v-if="afterXml"
                        ref="viewerAfter"
                        :bpmn="afterXml"
                        :diffActivities="diffActivitiesA"
                        :disable-auto-orientation="true"
                        @rendered="onAfterRendered"
                    />
                </div>
            </div>

            <div class="compare-rail">
                <div class="compare-rail-header">
                    <div class="text-subtitle-2 font-weight-bold">{{ $t('ProcessFeedbackCompare.changesTitle') }}</div>
                    <div class="diff-legend mt-2">
                        <span class="legend-item"><span class="legend-dot dot-added"></span>{{ $t('ProcessFeedback.nodeAdded') }}</span>
                        <span class="legend-item"><span class="legend-dot dot-modified"></span>{{ $t('ProcessFeedback.nodeModified') }}</span>
                        <span class="legend-item"><span class="legend-dot dot-removed"></span>{{ $t('ProcessFeedback.nodeRemoved') }}</span>
                    </div>
                </div>
                <div class="compare-rail-list">
                    <div
                        v-for="change in changes"
                        :key="change.id"
                        class="change-card"
                        :class="`change-card-${change.type}`"
                        @click="focusNode(change)"
                    >
                        <v-checkbox
                            :model-value="selectedIds.has(change.id)"
                            hide-details
                            color="primary"
                            density="compact"
                            class="change-checkbox"
                            @click.stop
                            @update:model-value="(v) => setSelected(change.id, v)"
                        />
                        <div class="change-bar" :class="`change-bar-${change.type}`"></div>
                        <div class="change-card-content">
                            <div class="change-card-title">
                                {{ change.name || change.id }}
                                <span class="change-tag" :class="`change-tag-${change.type}`">
                                    {{
                                        change.type === 'added'
                                            ? $t('ProcessFeedback.nodeAdded')
                                            : change.type === 'modified'
                                            ? $t('ProcessFeedback.nodeModified')
                                            : $t('ProcessFeedback.nodeRemoved')
                                    }}
                                </span>
                            </div>
                            <div class="change-card-sub" v-if="change.description">{{ change.description }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import BpmnUengineViewer from '@/components/BpmnUengineViewer.vue';
import { applySelectedChanges } from '@/utils/bpmnSelectiveMerge';

export default {
    name: 'ProcessFeedbackCompare',
    components: { BpmnUengineViewer },
    props: {
        beforeXml: { type: String, default: '' },
        afterXml: { type: String, default: '' },
        changes: { type: Array, default: () => [] },
        diffActivitiesA: { type: Object, default: () => ({}) },
        diffActivitiesB: { type: Object, default: () => ({}) },
        summary: { type: String, default: '' },
        isApplying: { type: Boolean, default: false }
    },
    data() {
        return {
            selectedIds: new Set(this.changes.map((c) => c.id)),
            mergeError: null
        };
    },
    methods: {
        cancel() {
            this.$emit('cancel');
        },
        // 반영 전 미리 병합 결과를 만들어 이미 화면에 떠 있는 bpmn-js 뷰어로 재파싱해본다
        // (bpmn-selective-merge-engine spec의 "병합 결과가 구조적으로 유효한지 검증한다" 요구사항).
        // 전체 선택 상태는 afterXml 자체이므로(이미 유효함이 보장됨) 재검증을 건너뛴다.
        async apply() {
            this.mergeError = null;
            const allIds = this.changes.map((c) => c.id);
            const isFullSelection = allIds.every((id) => this.selectedIds.has(id));
            if (!isFullSelection) {
                let merged;
                try {
                    merged = applySelectedChanges(this.beforeXml, this.afterXml, this.changes, Array.from(this.selectedIds));
                } catch (e) {
                    this.mergeError = e && e.message ? e.message : String(e);
                    return;
                }
                const viewer = this.$refs.viewerBefore && this.$refs.viewerBefore.bpmnViewer;
                if (viewer) {
                    let failed = false;
                    try {
                        // beforeXml 자체도 이 프로세스의 커스텀 확장 속성 때문에 무해한 warning을
                        // 항상 낸다(예: "unknown attribute <megaProcessId>") — beforeXml을 다시 import해
                        // baseline warning 집합을 구하고, merged import 시 baseline에 없던 새 warning만
                        // 실패로 간주한다(그래프 정합성이 깨진 경우 "unresolved reference"/
                        // "Ref not specified" 같은 새 warning이 나타난다).
                        const baseline = await viewer.importXML(this.beforeXml);
                        const baselineWarnings = new Set((baseline.warnings || []).map((w) => w.message || String(w)));
                        const result = await viewer.importXML(merged);
                        const newWarnings = (result.warnings || [])
                            .map((w) => w.message || String(w))
                            .filter((msg) => !baselineWarnings.has(msg));
                        if (newWarnings.length > 0) {
                            this.mergeError = newWarnings.join('\n');
                            failed = true;
                        }
                    } catch (e) {
                        this.mergeError = e && e.message ? e.message : String(e);
                        failed = true;
                    }
                    if (failed) {
                        try {
                            await viewer.importXML(this.beforeXml);
                        } catch (_) {
                            // 복구 실패는 무시 — 사용자가 취소 후 드로어를 다시 열면 새로 로드된다
                        }
                        return;
                    }
                }
            }
            this.$emit('apply', Array.from(this.selectedIds));
        },
        setSelected(id, checked) {
            const next = new Set(this.selectedIds);
            if (checked) next.add(id);
            else next.delete(id);
            this.selectedIds = next;
            this.syncOverlayCheckbox(id, checked);
        },
        focusNode(change) {
            const viewer = change.type === 'removed' ? this.$refs.viewerBefore : this.$refs.viewerAfter;
            this.scrollToElement(viewer, change.id);
        },
        scrollToElement(viewerComp, id) {
            if (!viewerComp || !viewerComp.bpmnViewer) return;
            try {
                const registry = viewerComp.bpmnViewer.get('elementRegistry');
                const el = registry.get(id);
                if (el) viewerComp.bpmnViewer.get('canvas').scrollToElement(el);
            } catch (e) {
                // 포커스 실패는 무시
            }
        },
        syncOverlayCheckbox(id, checked) {
            [this.$refs.viewerBefore, this.$refs.viewerAfter].forEach((viewerComp) => {
                if (!viewerComp || !viewerComp.$el) return;
                const input = viewerComp.$el.querySelector(`input[data-change-id="${id}"]`);
                if (input) input.checked = checked;
            });
        },
        onAfterRendered() {
            const viewerComp = this.$refs.viewerAfter;
            if (!viewerComp || !viewerComp.bpmnViewer) return;
            const bpmnViewer = viewerComp.bpmnViewer;
            const addOverlays = () => {
                const overlays = bpmnViewer.get('overlays');
                const registry = bpmnViewer.get('elementRegistry');
                this.changes
                    .filter((c) => c.type === 'added' || c.type === 'modified')
                    .forEach((c) => this.addCheckboxOverlay(overlays, registry, c.id));
                viewerComp.fitDiagramToViewport?.({ padding: 24, maxZoom: 1.5 });
            };

            // afterXml은 createBpmnXml(jsonModel)이 방금 생성한 XML이라 beforeXml(이미 저장된
            // snapshot)과 달리 레인/노드 좌표가 정리돼 있지 않을 수 있다. 다른 화면(ProcessDefinition.vue,
            // BpmnUengine.vue)이 쓰는 것과 동일한 paletteProvider.applyAutoLayout()으로 재배치한다.
            try {
                const paletteProvider = bpmnViewer.get('paletteProvider');
                if (paletteProvider && typeof paletteProvider.applyAutoLayout === 'function') {
                    const eventBus = bpmnViewer.get('eventBus');
                    eventBus.once('autoLayout.complete', addOverlays);
                    paletteProvider.applyAutoLayout();
                    return;
                }
            } catch (e) {
                // 오토레이아웃 실패 시 원래 좌표 그대로 오버레이만 추가
            }
            addOverlays();
        },
        onBeforeRendered() {
            const viewerComp = this.$refs.viewerBefore;
            if (!viewerComp || !viewerComp.bpmnViewer) return;
            const overlays = viewerComp.bpmnViewer.get('overlays');
            const registry = viewerComp.bpmnViewer.get('elementRegistry');
            this.changes.filter((c) => c.type === 'removed').forEach((c) => this.addCheckboxOverlay(overlays, registry, c.id));
        },
        addCheckboxOverlay(overlays, registry, id) {
            const el = registry.get(id);
            if (!el) return;
            const checked = this.selectedIds.has(id) ? 'checked' : '';
            const html = $(
                `<label class="feedback-compare-checkbox"><input type="checkbox" data-change-id="${id}" ${checked} /></label>`
            );
            html.find('input').on('change', (e) => {
                this.setSelected(id, e.target.checked);
            });
            try {
                overlays.add(id, 'feedback-compare', {
                    position: { top: -8, left: -8 },
                    html
                });
            } catch (e) {
                // 오버레이 부착 실패 시 조용히 무시(해당 노드는 체크박스 없이 기본 선택 상태로 반영됨)
            }
        }
    }
};
</script>

<style scoped>
.compare-root {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.compare-header {
    flex: none;
    display: flex;
    align-items: center;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.compare-summary {
    margin-left: 14px;
    max-width: 420px;
    color: rgba(var(--v-theme-on-surface), 0.65);
    font-size: 13px;
}

.compare-selection-count {
    font-size: 12.5px;
    color: rgba(var(--v-theme-on-surface), 0.6);
    white-space: nowrap;
}

.compare-body {
    flex: 1;
    display: flex;
    overflow: hidden;
}

.compare-panel {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
}

.compare-panel-bar {
    flex: none;
    padding: 8px 16px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.compare-badge {
    font-size: 12px;
    font-weight: 700;
    padding: 3px 11px;
    border-radius: 8px;
}

.badge-before {
    background: rgba(var(--v-theme-on-surface), 0.08);
    color: rgba(var(--v-theme-on-surface), 0.7);
}

.badge-after {
    background: rgba(var(--v-theme-primary), 0.12);
    color: rgb(var(--v-theme-primary));
}

.compare-canvas {
    flex: 1;
    position: relative;
    overflow: hidden;
}

.compare-rail {
    width: 340px;
    flex: none;
    border-left: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.compare-rail-header {
    flex: none;
    padding: 14px 16px 8px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.diff-legend {
    display: flex;
    gap: 12px;
    font-size: 11.5px;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
    color: rgba(var(--v-theme-on-surface), 0.6);
}

.legend-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
}

.dot-added {
    background: rgb(var(--v-theme-success));
}

.dot-modified {
    background: rgb(var(--v-theme-warning));
}

.dot-removed {
    background: rgb(var(--v-theme-error));
}

.compare-rail-list {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
}

.change-card {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    margin-bottom: 6px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 8px;
    cursor: pointer;
    transition: 0.12s;
}

.change-card:hover {
    background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.change-checkbox {
    flex: none;
}

.change-bar {
    width: 4px;
    align-self: stretch;
    border-radius: 3px;
    flex: none;
}

.change-bar-added {
    background-color: rgb(var(--v-theme-success));
}

.change-bar-modified {
    background-color: rgb(var(--v-theme-warning));
}

.change-bar-removed {
    background-color: rgb(var(--v-theme-error));
}

.change-card-content {
    flex: 1;
    min-width: 0;
}

.change-card-title {
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
}

.change-card-sub {
    font-size: 11.5px;
    color: rgba(var(--v-theme-on-surface), 0.6);
    margin-top: 2px;
}

.change-tag {
    font-size: 9.5px;
    font-weight: 700;
    border-radius: 5px;
    padding: 1px 6px;
    color: #fff;
    white-space: nowrap;
}

.change-tag-added {
    background-color: rgb(var(--v-theme-success));
}

.change-tag-modified {
    background-color: rgb(var(--v-theme-warning));
}

.change-tag-removed {
    background-color: rgb(var(--v-theme-error));
}
</style>

<style>
.feedback-compare-checkbox {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: #fff;
    border: 2px solid #1976d2;
    border-radius: 5px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    cursor: pointer;
}

.feedback-compare-checkbox input[type='checkbox'] {
    width: 15px;
    height: 15px;
    cursor: pointer;
}
</style>

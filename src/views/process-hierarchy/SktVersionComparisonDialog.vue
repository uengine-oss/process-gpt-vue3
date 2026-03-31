<template>
    <v-dialog
        :model-value="modelValue"
        fullscreen
        transition="dialog-bottom-transition"
        @update:model-value="$emit('update:modelValue', $event)"
    >
        <v-card class="skt-version-diff-card">
            <v-card-title class="skt-version-diff-header">
                <div class="skt-version-diff-header-left">
                    <v-icon class="mr-2" size="20">mdi-compare-horizontal</v-icon>
                    <span class="skt-version-diff-title">SKT버전비교다이얼로그</span>
                    <span class="text-caption text-medium-emphasis ml-3">
                        v{{ internalSelectedVersion }} vs 현재 버전
                    </span>
                </div>
                <div class="skt-version-diff-header-right">
                    <div class="skt-version-diff-legend">
                        <span class="skt-version-diff-legend-item">
                            <span class="skt-version-diff-legend-dot skt-diff-dot-added"></span>추가
                        </span>
                        <span class="skt-version-diff-legend-item">
                            <span class="skt-version-diff-legend-dot skt-diff-dot-modified"></span>수정
                        </span>
                        <span class="skt-version-diff-legend-item">
                            <span class="skt-version-diff-legend-dot skt-diff-dot-removed"></span>삭제
                        </span>
                    </div>
                    <v-btn icon variant="text" size="small" @click="$emit('update:modelValue', false)">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </div>
            </v-card-title>
            <v-divider />

            <v-card-text class="skt-version-diff-body pa-0">
                <div class="skt-version-diff-viewers">
                    <!-- 선택된 버전 (Old) -->
                    <div class="skt-version-diff-viewer-panel">
                        <div class="skt-version-diff-viewer-bar">
                            <span class="skt-version-diff-badge skt-diff-badge-old">선택 버전</span>
                            <v-select
                                v-model="internalSelectedVersion"
                                :items="versionSelectItems"
                                item-title="title"
                                item-value="value"
                                density="compact"
                                variant="outlined"
                                hide-details
                                class="skt-version-diff-version-select ml-3"
                                @update:model-value="onVersionChange"
                            />
                            <v-btn
                                color="primary"
                                size="small"
                                :disabled="!activeOldXml || rollbackLoading"
                                :loading="rollbackLoading"
                                class="ml-3 skt-version-diff-rollback-btn"
                                @click="rollbackConfirmDialog = true"
                            >
                                <v-icon start size="16">mdi-backup-restore</v-icon>
                                v{{ internalSelectedVersion }} 버전으로 변경
                            </v-btn>
                        </div>
                        <div class="skt-version-diff-viewer-canvas">
                            <BpmnUengineViewer
                                v-if="activeOldXml"
                                ref="diffViewerOld"
                                :key="'skt-diff-old-' + diffRenderKey"
                                :bpmn="activeOldXml"
                                :diffActivities="diffActivitiesOld"
                                @rendered="onViewerRendered($refs.diffViewerOld)"
                            />
                            <div v-else class="skt-version-diff-empty">
                                <v-icon size="32" color="grey-lighten-1">mdi-file-document-outline</v-icon>
                                <div class="text-caption text-medium-emphasis mt-2">BPMN 데이터 없음</div>
                            </div>
                        </div>
                    </div>
                    <v-divider vertical />
                    <!-- 현재 버전 (New) -->
                    <div class="skt-version-diff-viewer-panel">
                        <div class="skt-version-diff-viewer-bar">
                            <span class="skt-version-diff-badge skt-diff-badge-new">
                                현재 버전
                            </span>
                        </div>
                        <div class="skt-version-diff-viewer-canvas">
                            <BpmnUengineViewer
                                v-if="currentBpmnXml"
                                ref="diffViewerNew"
                                :key="'skt-diff-new-' + diffRenderKey"
                                :bpmn="currentBpmnXml"
                                :diffActivities="diffActivitiesNew"
                                @rendered="onViewerRendered($refs.diffViewerNew)"
                            />
                            <div v-else class="skt-version-diff-empty">
                                <v-icon size="32" color="grey-lighten-1">mdi-file-document-outline</v-icon>
                                <div class="text-caption text-medium-emphasis mt-2">BPMN 데이터 없음</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 변경점 요약 -->
                <div v-if="diffChanges.length > 0" class="skt-version-diff-changes-summary">
                    <div class="skt-version-diff-changes-header">
                        <v-icon size="16" class="mr-1">mdi-format-list-bulleted</v-icon>
                        변경점 {{ diffChanges.length }}건
                    </div>
                    <div class="skt-version-diff-changes-list">
                        <div
                            v-for="(change, idx) in diffChanges"
                            :key="idx"
                            class="skt-version-diff-change-item"
                        >
                            <span
                                class="skt-version-diff-change-badge"
                                :class="'skt-version-diff-change-badge-' + change.type"
                            >
                                {{ change.type }}
                            </span>
                            <span class="skt-version-diff-change-text">
                                {{ formatElementTypeName(change.elementType) }}: {{ change.name || change.id }}
                            </span>
                            <span v-if="change.description" class="skt-version-diff-change-desc">
                                {{ change.description }}
                            </span>
                        </div>
                    </div>
                </div>
                <div v-else-if="activeOldXml && currentBpmnXml && !diffLoading" class="skt-version-diff-no-changes">
                    <v-icon size="28" color="grey-lighten-1">mdi-check-circle-outline</v-icon>
                    <div class="text-caption text-medium-emphasis mt-2">변경점이 없습니다.</div>
                </div>
                <div v-if="diffLoading" class="skt-version-diff-loading">
                    <v-progress-circular indeterminate size="24" width="2" color="primary" />
                    <div class="text-caption text-medium-emphasis mt-2">비교 중...</div>
                </div>
            </v-card-text>
        </v-card>
    </v-dialog>

    <!-- 롤백 확인 다이얼로그 -->
    <v-dialog v-model="rollbackConfirmDialog" max-width="420" persistent>
        <v-card rounded="lg">
            <v-card-title class="d-flex align-center pa-4">
                <v-icon color="warning" class="mr-2">mdi-alert-circle-outline</v-icon>
                버전 변경
            </v-card-title>
            <v-card-text class="px-4 pb-4">
                <strong>v{{ internalSelectedVersion }}</strong> 버전으로 변경하시겠습니까?<br />
                현재 버전의 내용이 선택한 버전으로 교체됩니다.
            </v-card-text>
            <v-divider />
            <v-card-actions class="pa-3">
                <v-spacer />
                <v-btn variant="text" @click="rollbackConfirmDialog = false">취소</v-btn>
                <v-btn color="primary" variant="flat" :loading="rollbackLoading" @click="executeRollback">확인</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import BpmnUengineViewer from '@/components/BpmnUengineViewer.vue';
import { computeBpmnDiff, formatElementTypeName } from '@/utils/bpmnDiff';
import type { BpmnChange } from '@/utils/bpmnDiff';

type VersionItem = Record<string, unknown>;

const props = defineProps<{
    modelValue: boolean;
    selectedVersionLabel: string;
    selectedVersionXml: string;
    currentBpmnXml: string;
    versions: VersionItem[];
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
    (e: 'rollback', payload: { xml: string; versionLabel: string }): void;
}>();

const rollbackLoading = ref(false);
const rollbackConfirmDialog = ref(false);

const diffViewerOld = ref(null);
const diffViewerNew = ref(null);
const diffRenderKey = ref(0);
const diffLoading = ref(false);
const diffChanges = ref<BpmnChange[]>([]);
const diffActivitiesOld = ref<Record<string, string>>({});
const diffActivitiesNew = ref<Record<string, string>>({});

const internalSelectedVersion = ref('');
const activeOldXml = ref('');

const versionSelectItems = computed(() => {
    return (props.versions || []).map((v) => ({
        title: `v${v.version}${v.version_tag ? ` · ${v.version_tag}` : ''}`,
        value: String(v.version),
    }));
});

watch(() => props.modelValue, (opened) => {
    rollbackLoading.value = false;
    rollbackConfirmDialog.value = false;
    if (opened) {
        internalSelectedVersion.value = props.selectedVersionLabel;
        activeOldXml.value = props.selectedVersionXml;
        diffChanges.value = [];
        diffActivitiesOld.value = {};
        diffActivitiesNew.value = {};
        diffRenderKey.value++;
        nextTick(() => {
            runDiffComputation(activeOldXml.value, props.currentBpmnXml);
        });
    }
});

function onVersionChange(version: string) {
    const matched = (props.versions || []).find(
        (v) => String(v.version) === String(version)
    );
    const xml = (matched?.snapshot as string) || '';
    if (!xml) return;

    activeOldXml.value = xml;
    diffChanges.value = [];
    diffActivitiesOld.value = {};
    diffActivitiesNew.value = {};
    diffRenderKey.value++;
    nextTick(() => {
        runDiffComputation(xml, props.currentBpmnXml);
    });
}

function executeRollback() {
    if (!activeOldXml.value || !internalSelectedVersion.value) return;
    rollbackLoading.value = true;
    rollbackConfirmDialog.value = false;
    emit('rollback', {
        xml: activeOldXml.value,
        versionLabel: internalSelectedVersion.value,
    });
}

function runDiffComputation(oldXml: string, newXml: string) {
    if (!oldXml || !newXml) return;
    diffLoading.value = true;
    setTimeout(() => {
        try {
            const result = computeBpmnDiff(oldXml, newXml);
            diffChanges.value = result.changes;
            diffActivitiesOld.value = result.diffActivitiesB;
            diffActivitiesNew.value = result.diffActivitiesA;
            diffRenderKey.value++;
        } catch {
            diffChanges.value = [];
        } finally {
            diffLoading.value = false;
        }
    }, 100);
}

function onViewerRendered(viewer: Record<string, unknown>) {
    nextTick(() => {
        setTimeout(() => {
            const v = viewer as Record<string, Record<string, (...args: unknown[]) => unknown>>;
            if (v?.bpmnViewer) {
                try {
                    const canvas = v.bpmnViewer.get('canvas') as Record<string, (...args: unknown[]) => unknown>;
                    canvas.zoom('fit-viewport', 'auto');
                } catch {
                    // fallback
                }
            }
        }, 150);
    });
}
</script>

<style scoped>
.skt-version-diff-card {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.skt-version-diff-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px !important;
    flex-shrink: 0;
}

.skt-version-diff-title {
    font-size: 16px;
    font-weight: 700;
}

.skt-version-diff-header-left {
    display: flex;
    align-items: center;
}

.skt-version-diff-header-right {
    display: flex;
    align-items: center;
    gap: 16px;
}

.skt-version-diff-legend {
    display: flex;
    gap: 12px;
    font-size: 12px;
}

.skt-version-diff-legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #666;
}

.skt-version-diff-legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.skt-diff-dot-added { background: #4caf50; }
.skt-diff-dot-modified { background: #ff9800; }
.skt-diff-dot-removed { background: #f44336; }

.skt-version-diff-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.skt-version-diff-viewers {
    display: flex;
    flex: 1;
    min-height: 0;
}

.skt-version-diff-viewer-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
}

.skt-version-diff-viewer-bar {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    background: #fafafa;
    border-bottom: 1px solid #eee;
    flex-shrink: 0;
}

.skt-version-diff-badge {
    font-size: 12px;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: 12px;
    white-space: nowrap;
}

.skt-diff-badge-old {
    background: #f3e5f5;
    color: #7b1fa2;
}

.skt-version-diff-version-select {
    max-width: 160px;
}

.skt-version-diff-version-select :deep(.v-field) {
    min-height: 32px !important;
    font-size: 13px;
}

.skt-version-diff-version-select :deep(.v-field__input) {
    padding-top: 4px;
    padding-bottom: 4px;
}

.skt-diff-badge-new {
    background: #e3f2fd;
    color: #1565c0;
}

.skt-version-diff-viewer-canvas {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #fafafa;
}

.skt-version-diff-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
}

/* 변경점 요약 */
.skt-version-diff-changes-summary {
    border-top: 1px solid #e5e7eb;
    max-height: 200px;
    overflow-y: auto;
    flex-shrink: 0;
}

.skt-version-diff-changes-header {
    display: flex;
    align-items: center;
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 600;
    color: #374151;
    background: #f8fafc;
    border-bottom: 1px solid #f0f0f0;
    position: sticky;
    top: 0;
    z-index: 1;
}

.skt-version-diff-changes-list {
    padding: 4px 12px;
}

.skt-version-diff-change-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 4px;
    border-bottom: 1px solid #f5f5f5;
    font-size: 12px;
}

.skt-version-diff-change-item:last-child {
    border-bottom: none;
}

.skt-version-diff-change-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
    text-transform: lowercase;
    flex-shrink: 0;
}

.skt-version-diff-change-badge-added {
    background: #e8f5e9;
    color: #2e7d32;
}

.skt-version-diff-change-badge-modified {
    background: #fff3e0;
    color: #e65100;
}

.skt-version-diff-change-badge-removed {
    background: #ffebee;
    color: #c62828;
}

.skt-version-diff-change-text {
    font-weight: 500;
    color: #1f2937;
}

.skt-version-diff-change-desc {
    color: #6b7280;
    flex-shrink: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.skt-version-diff-no-changes {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    border-top: 1px solid #e5e7eb;
    flex-shrink: 0;
}

.skt-version-diff-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px;
    flex-shrink: 0;
}

.skt-version-diff-rollback-btn {
    text-transform: none !important;
}
</style>

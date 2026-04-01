<template>
    <div class="hierarchy-designer">
        <!-- Header Toolbar -->
        <div class="designer-toolbar">
            <div class="toolbar-left">
                <template v-if="processName">
                    <span class="process-name font-weight-bold">{{ processName }}</span>
                    <ProgressBadge v-if="currentStatus" type="status" :status="currentStatus" size="x-small" class="ml-2" />
                    <span v-if="currentVersion" class="text-caption text-medium-emphasis ml-2"> v{{ currentVersion }} </span>
                </template>
                <span v-else class="text-medium-emphasis">
                    {{ $t('processHierarchy.selectProcess') || '왼쪽 트리에서 프로세스를 선택하세요' }}
                </span>
            </div>
            <div class="toolbar-right d-flex align-center">
                <!-- useLock: 기본(보기 전용)은 연필, 편집 중은 잠금 해제 + 저장. 주변 툴바와 동일하게 아이콘 + 텍스트 -->
                <template v-if="useLock && processName">
                    <!-- 기본/잠금 상태(보기 전용): 연필 + "편집" -->
                    <template v-if="!canEdit">
                        <v-tooltip location="bottom">
                            <template v-slot:activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    variant="text"
                                    size="small"
                                    @click="$emit('requestLock')"
                                >
                                    <v-icon start size="16">mdi-pencil</v-icon>
                                    {{ $t('processHierarchy.edit') || '편집' }}
                                </v-btn>
                            </template>
                            <span v-if="lockedByOther">{{ checkoutTooltip }}</span>
                            <span v-else>{{ $t('chat.unlock') }}</span>
                        </v-tooltip>
                    </template>
                    <!-- 편집 중: 잠금 해제 + 저장 (아이콘 + 텍스트) -->
                    <template v-else>
                        <v-tooltip location="bottom">
                            <template v-slot:activator="{ props }">
                                <v-btn v-bind="props" variant="text" size="small" @click="$emit('releaseLock')">
                                    <v-icon start size="16">mdi-lock-open-outline</v-icon>
                                    {{ $t('chat.lockOnly') }}
                                </v-btn>
                            </template>
                            <span>{{ $t('chat.lockOnly') }}</span>
                        </v-tooltip>
                        <v-tooltip location="bottom">
                            <template v-slot:activator="{ props }">
                                <v-btn v-bind="props" variant="text" size="small" @click="$emit('save')">
                                    <v-icon start size="16">mdi-content-save</v-icon>
                                    {{ $t('chat.processDefinitionSave') }}
                                </v-btn>
                            </template>
                            <span>{{ $t('chat.processDefinitionSave') }}</span>
                        </v-tooltip>
                    </template>
                </template>
                <template v-else-if="processName">
                    <v-btn variant="text" size="small" :disabled="!processName" @click="$emit('save')">
                        <v-icon start size="16">mdi-content-save</v-icon>
                        {{ $t('processHierarchy.save') || 'Save' }}
                    </v-btn>
                </template>
                <v-divider v-if="processName" vertical class="mx-1" />
                <v-btn variant="text" size="small" :disabled="!processName || !canEdit" @click="handleValidate">
                    <v-icon start size="16">mdi-check-circle-outline</v-icon>
                    {{ $t('processHierarchy.validate') || 'Validate' }}
                </v-btn>
                <v-divider vertical class="mx-1" />
                <v-btn
                    :variant="isWip ? 'flat' : 'text'"
                    :color="isWip ? 'purple' : undefined"
                    size="small"
                    :disabled="!processName || !canEdit"
                    @click="$emit('toggleWip')"
                >
                    <v-icon start size="16">{{ isWip ? 'mdi-progress-wrench' : 'mdi-progress-wrench' }}</v-icon>
                    {{ isWip ? $t('processHierarchy.wipOn') || 'WIP 해제' : $t('processHierarchy.wipOff') || 'WIP 설정' }}
                </v-btn>
                <v-divider vertical class="mx-1" />
                <v-btn variant="text" size="small" :disabled="!processName" @click="$emit('clone')">
                    <v-icon start size="16">mdi-content-copy</v-icon>
                    {{ $t('processHierarchy.clone') || 'Clone Process' }}
                </v-btn>
                <v-btn variant="text" size="small" :disabled="!processName" @click="$emit('versionHistory')">
                    <v-icon start size="16">mdi-history</v-icon>
                    {{ $t('processHierarchy.versionHistory') || 'Version History' }}
                </v-btn>
            </div>
        </div>

        <!-- BPMN Canvas -->
        <div class="designer-canvas" v-show="bpmn">
            <BpmnuEngine
                ref="bpmnVue"
                :key="bpmnKey"
                :bpmn="bpmn"
                :isViewMode="!canEdit"
                :show-read-only-label="!canEdit"
                :lock-holder-name="bpmnLockHolderName"
                @openPanel="(id) => $emit('openPanel', id)"
                @update-xml="(val) => $emit('updateXml', val)"
                @definition="(def) => $emit('definition', def)"
                @done="onBpmnDone"
            />
            <ValidationConsolePanel
                :show="showValidationConsole"
                :items="validationConsoleItems"
                @close="onValidationConsoleClose"
                @focusElement="focusElement"
            />
        </div>

        <!-- Empty State -->
        <div v-if="!bpmn && !loading" class="designer-empty">
            <v-icon size="64" color="grey-lighten-1">mdi-file-document-outline</v-icon>
            <div class="text-h6 text-medium-emphasis mt-4">
                {{ $t('processHierarchy.emptyState') || '프로세스를 선택하세요' }}
            </div>
            <div class="text-body-2 text-medium-emphasis mt-1">
                {{ $t('processHierarchy.emptyStateDesc') || '왼쪽 트리에서 서브 프로세스를 클릭하면 BPMN 에디터가 표시됩니다.' }}
            </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="designer-empty">
            <v-progress-circular indeterminate color="primary" size="48" />
            <div class="text-body-2 text-medium-emphasis mt-4">Loading...</div>
        </div>

    </div>
</template>

<script>
import BpmnuEngine from '@/components/BpmnUengine.vue';
import ProgressBadge from '@/components/ui/ProgressBadge.vue';
import ValidationConsolePanel from '@/components/ui/ValidationConsolePanel.vue';
import { useBpmnStore } from '@/stores/bpmn';
import { validateBpmnModel } from '@/utils/bpmnModelValidation';
import { createBpmnValidationOverlayElement } from '@/utils/bpmnValidationOverlayHtml.js';

export default {
    name: 'ProcessHierarchyDesigner',
    components: { BpmnuEngine, ProgressBadge, ValidationConsolePanel },
    props: {
        bpmn: { type: String, default: '' },
        processName: { type: String, default: '' },
        processDefinition: { type: Object, default: null },
        definitionPath: { type: String, default: '' },
        definitionList: { type: Array, default: () => [] },
        loading: { type: Boolean, default: false },
        useLock: { type: Boolean, default: false },
        lock: { type: Boolean, default: false },
        editUser: { type: String, default: '' },
        editUserDisplayName: { type: String, default: '' },
        currentUserId: { type: String, default: '' }
    },
    emits: ['openPanel', 'updateXml', 'save', 'clone', 'versionHistory', 'definition', 'toggleWip', 'requestLock', 'releaseLock'],
    data() {
        return {
            bpmnKey: 0,
            showValidationConsole: false,
            validationConsoleItems: [],
            validationOverlayIds: [],
            validationMarkerIds: []
        };
    },
    computed: {
        currentStatus() {
            if (!this.definitionPath || !this.definitionList) return '';
            const def = this.definitionList.find((d) => (d.file_name || d.id) === this.definitionPath);
            return def?.approval_state || def?.status || '';
        },
        currentVersion() {
            if (!this.definitionPath || !this.definitionList) return '';
            const def = this.definitionList.find((d) => (d.file_name || d.id) === this.definitionPath);
            return def?.version || def?.version_tag || '';
        },
        isWip() {
            if (!this.definitionPath || !this.definitionList) return false;
            const def = this.definitionList.find((d) => (d.file_name || d.id) === this.definitionPath);
            return def?.approval_state === 'wip' || def?.status === 'wip';
        },
        lockedByOther() {
            return !!(
                this.useLock &&
                this.lock &&
                this.editUser &&
                this.currentUserId &&
                this.editUser !== this.currentUserId
            );
        },
        /** useLock일 때 lock을 보유한 경우에만 편집 가능, 그 전에는 기본 viewMode */
        canEdit() {
            if (!this.useLock) return true;
            return !!(this.lock && this.editUser && this.currentUserId && this.editUser === this.currentUserId);
        },
        lockHeldByCurrentUser() {
            return this.canEdit && this.useLock && this.lock;
        },
        /** 다른 사용자가 잠금 보유 시 BPMN 캔버스에 표시 */
        bpmnLockHolderName() {
            if (!this.useLock || !this.lockedByOther) return '';
            return (this.editUserDisplayName || this.editUser || '').trim();
        },
        checkoutTooltip() {
            const name = this.editUserDisplayName || this.editUser || '';
            const fallback =
                '현재 {name} 님께서 수정 중입니다. 체크아웃 하는 경우 해당 사용자가 수정한 내용은 저장되지 않습니다. 체크아웃 하시겠습니까?';
            return this.$t('processHierarchy.checkoutTooltip', { name: name || '—' }) || fallback.replace('{name}', name || '—');
        }
    },
    watch: {
        bpmn(newVal, oldVal) {
            if (newVal !== oldVal && newVal) {
                this.bpmnKey++;
                this.validationOverlayIds = [];
                this.validationMarkerIds = [];
                this.showValidationConsole = false;
                this.validationConsoleItems = [];
            }
        }
    },
    methods: {
        onBpmnDone() {
            this.$nextTick(() => {
                const bpmnVue = this.$refs.bpmnVue;
                if (!bpmnVue) return;

                // ResizeObserver의 자동 orientation 변경을 항상 horizontal로 고정
                bpmnVue.onContainerResizeFinished = () => {
                    bpmnVue.initDefaultOrientation('horizontal');
                    if (bpmnVue.EventBus) {
                        bpmnVue.EventBus.emit('orientation-changed', { isHorizontal: true });
                    }
                    setTimeout(() => {
                        if (bpmnVue.resetZoom) bpmnVue.resetZoom();
                    }, 100);
                };

                if (bpmnVue.initDefaultOrientation) {
                    bpmnVue.initDefaultOrientation('horizontal');
                }
                setTimeout(() => {
                    if (bpmnVue.resetZoom) {
                        bpmnVue.resetZoom();
                    }
                }, 500);
            });
        },

        clearValidationOverlays() {
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            try {
                const overlays = modeler.get('overlays');
                const canvas = modeler.get('canvas');
                const elementRegistry = modeler.get('elementRegistry');

                // 타입 기반으로 모든 validation 오버레이 일괄 제거 (ID 추적 실패 방지)
                try {
                    overlays.remove({ type: 'validation-error' });
                } catch (e) {
                    /* ignore */
                }
                try {
                    overlays.remove({ type: 'validation-warning' });
                } catch (e) {
                    /* ignore */
                }

                // 모든 요소에서 validation 마커 제거
                elementRegistry.getAll().forEach((el) => {
                    try {
                        canvas.removeMarker(el.id, 'validation-error-element');
                    } catch (e) {
                        /* ignore */
                    }
                    try {
                        canvas.removeMarker(el.id, 'validation-warning-element');
                    } catch (e) {
                        /* ignore */
                    }
                });

                this.validationOverlayIds = [];
                this.validationMarkerIds = [];
            } catch (e) {
                // modeler가 아직 초기화되지 않은 경우
            }
        },

        clearValidation() {
            this.clearValidationOverlays();
            this.validationConsoleItems = [];
            this.showValidationConsole = false;
        },

        onValidationConsoleClose() {
            this.clearValidation();
        },

        focusElement(elementId) {
            if (!elementId) return;
            const bpmnVue = this.$refs.bpmnVue;
            if (bpmnVue?.focusElement) {
                bpmnVue.focusElement(elementId);
                return;
            }
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            try {
                const canvas = modeler.get('canvas');
                const elementRegistry = modeler.get('elementRegistry');
                const element = elementRegistry.get(elementId);
                if (element) {
                    canvas.scrollToElement(element);
                    const selection = modeler.get('selection');
                    if (selection) selection.select(element);
                }
            } catch (e) {
                /* ignore */
            }
        },

        createOverlayHtml(errors) {
            return createBpmnValidationOverlayElement(errors, this.$t.bind(this));
        },

        async handleValidate() {
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            this.clearValidationOverlays();

            const issues = validateBpmnModel(modeler);

            try {
                const elementRegistry = modeler.get('elementRegistry');
                const overlays = modeler.get('overlays');
                const canvas = modeler.get('canvas');

                const byElement = new Map();
                issues.forEach((issue) => {
                    if (!issue.elementId) return;
                    if (!byElement.has(issue.elementId)) byElement.set(issue.elementId, []);
                    byElement.get(issue.elementId).push(issue);
                });

                byElement.forEach((elementErrors, elementId) => {
                    const element = elementRegistry.get(elementId);
                    if (!element) return;

                    const isWarningOnly = elementErrors.every((e) => e.level === 'warning');
                    const markerClass = isWarningOnly ? 'validation-warning-element' : 'validation-error-element';
                    const overlayType = isWarningOnly ? 'validation-warning' : 'validation-error';

                    try {
                        canvas.addMarker(elementId, markerClass);
                        this.validationMarkerIds.push(elementId);
                    } catch (e) {
                        /* ignore */
                    }

                    try {
                        const overlayHtml = this.createOverlayHtml(elementErrors);
                        const overlayId = overlays.add(elementId, overlayType, {
                            position: {
                                top: -12,
                                left: (element.width || 100) + 8
                            },
                            html: overlayHtml
                        });
                        this.validationOverlayIds.push(overlayId);
                    } catch (e) {
                        console.warn('Failed to add overlay for', elementId, e);
                    }
                });
            } catch (e) {
                console.error('Validation error:', e);
            }

            if (issues.length > 0) {
                this.validationConsoleItems = issues.map((issue) => ({
                    level: issue.level,
                    message: issue.message,
                    elementName: issue.elementName,
                    elementId: issue.elementId
                }));
                this.showValidationConsole = true;
            } else {
                this.showValidationConsole = false;
                this.validationConsoleItems = [];
                if (this.$toast) {
                    this.$toast.success(this.$t('processHierarchy.validationPassed') || '검증 통과');
                }
            }
        }
    }
};
</script>

<style scoped>
.hierarchy-designer {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #fff;
}

.designer-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid #e0e0e0;
    background: #fafafa;
    flex-shrink: 0;
    min-height: 48px;
}

.toolbar-left {
    display: flex;
    align-items: center;
    min-width: 0;
}

.process-name {
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 300px;
}

.toolbar-right {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}

.designer-canvas {
    flex: 1;
    position: relative;
    overflow: hidden;
}

.designer-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.cursor-pointer {
    cursor: pointer;
}
</style>

<style>
/* 검증 에러 마커 - scoped가 아닌 global CSS (bpmn-js DOM에 적용) */
.validation-error-element .djs-visual > :nth-child(1) {
    stroke: rgb(var(--v-theme-error)) !important;
    stroke-width: 2.5px !important;
}
.validation-error-element .djs-outline {
    stroke: rgb(var(--v-theme-error)) !important;
    stroke-width: 1px !important;
    stroke-dasharray: 4 3;
}
/* 검증 경고 마커 */
.validation-warning-element .djs-visual > :nth-child(1) {
    stroke: rgb(var(--v-theme-warning)) !important;
    stroke-width: 2.5px !important;
}
.validation-warning-element .djs-outline {
    stroke: rgb(var(--v-theme-warning)) !important;
    stroke-width: 1px !important;
    stroke-dasharray: 4 3;
}
</style>

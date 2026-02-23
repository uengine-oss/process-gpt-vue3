<template>
    <div class="hierarchy-designer">
        <!-- Header Toolbar -->
        <div class="designer-toolbar">
            <div class="toolbar-left">
                <template v-if="processName">
                    <span class="process-name font-weight-bold">{{ processName }}</span>
                    <ProgressBadge
                        v-if="currentStatus"
                        type="status"
                        :status="currentStatus"
                        size="x-small"
                        class="ml-2"
                    />
                    <span v-if="currentVersion" class="text-caption text-medium-emphasis ml-2">
                        v{{ currentVersion }}
                    </span>
                </template>
                <span v-else class="text-medium-emphasis">
                    {{ $t('processHierarchy.selectProcess') || '왼쪽 트리에서 프로세스를 선택하세요' }}
                </span>
            </div>
            <div class="toolbar-right">
                <v-btn
                    variant="text"
                    size="small"
                    :disabled="!processName"
                    @click="$emit('save')"
                >
                    <v-icon start size="16">mdi-content-save</v-icon>
                    {{ $t('processHierarchy.save') || 'Save' }}
                </v-btn>
                <v-btn
                    variant="text"
                    size="small"
                    :disabled="!processName"
                    @click="handleValidate"
                >
                    <v-icon start size="16">mdi-check-circle-outline</v-icon>
                    {{ $t('processHierarchy.validate') || 'Validate' }}
                </v-btn>
                <v-btn
                    variant="text"
                    size="small"
                    :disabled="!processName"
                    @click="$emit('clone')"
                >
                    <v-icon start size="16">mdi-content-copy</v-icon>
                    {{ $t('processHierarchy.clone') || 'Clone Process' }}
                </v-btn>
                <v-btn
                    variant="text"
                    size="small"
                    :disabled="!processName"
                    @click="$emit('versionHistory')"
                >
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
                :isViewMode="false"
                @openPanel="(id) => $emit('openPanel', id)"
                @update-xml="(val) => $emit('updateXml', val)"
                @definition="(def) => $emit('definition', def)"
                @done="onBpmnDone"
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

        <!-- Validation Results Dialog -->
        <v-dialog v-model="validationDialog" max-width="500">
            <v-card>
                <v-card-title class="d-flex align-center">
                    <v-icon color="warning" class="mr-2">mdi-alert-circle-outline</v-icon>
                    {{ $t('validation.title') || 'BPMN 검증 결과' }}
                </v-card-title>
                <v-card-text>
                    <div class="text-body-2 mb-3">{{ $t('validation.warningMessage') || '다음 문제가 발견되었습니다:' }}</div>
                    <v-list density="compact">
                        <v-list-item
                            v-for="(result, i) in validationResults"
                            :key="i"
                            @click="focusElement(result.elementId)"
                            :class="{ 'cursor-pointer': result.elementId }"
                        >
                            <template v-slot:prepend>
                                <v-icon :color="result.level === 'error' ? 'error' : 'warning'" size="18">
                                    {{ result.level === 'error' ? 'mdi-alert-circle' : 'mdi-alert' }}
                                </v-icon>
                            </template>
                            <v-list-item-title class="text-body-2">{{ result.message }}</v-list-item-title>
                            <v-list-item-subtitle v-if="result.elementName" class="text-caption">
                                {{ result.elementName }}
                            </v-list-item-subtitle>
                        </v-list-item>
                    </v-list>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="clearValidation">
                        {{ $t('validation.clearOverlays') || 'Clear Overlays' }}
                    </v-btn>
                    <v-btn @click="validationDialog = false">{{ $t('common.close') || 'Close' }}</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import BpmnuEngine from '@/components/BpmnUengine.vue';
import ProgressBadge from '@/components/ui/ProgressBadge.vue';
import { useBpmnStore } from '@/stores/bpmn';

export default {
    name: 'ProcessHierarchyDesigner',
    components: { BpmnuEngine, ProgressBadge },
    props: {
        bpmn: { type: String, default: '' },
        processName: { type: String, default: '' },
        processDefinition: { type: Object, default: null },
        definitionPath: { type: String, default: '' },
        definitionList: { type: Array, default: () => [] },
        loading: { type: Boolean, default: false },
    },
    emits: ['openPanel', 'updateXml', 'save', 'clone', 'versionHistory', 'definition'],
    data() {
        return {
            bpmnKey: 0,
            validationDialog: false,
            validationResults: [],
            validationOverlayIds: [],
            validationMarkerIds: [],
        };
    },
    computed: {
        currentStatus() {
            if (!this.definitionPath || !this.definitionList) return '';
            const def = this.definitionList.find(
                d => (d.file_name || d.id) === this.definitionPath
            );
            return def?.approval_state || def?.status || '';
        },
        currentVersion() {
            if (!this.definitionPath || !this.definitionList) return '';
            const def = this.definitionList.find(
                d => (d.file_name || d.id) === this.definitionPath
            );
            return def?.version || def?.version_tag || '';
        },
    },
    watch: {
        bpmn(newVal, oldVal) {
            if (newVal !== oldVal && newVal) {
                this.bpmnKey++;
                // BPMN이 바뀌면 이전 validation overlay 초기화
                this.validationOverlayIds = [];
                this.validationMarkerIds = [];
            }
        },
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
                try { overlays.remove({ type: 'validation-error' }); } catch (e) { /* ignore */ }

                // 모든 요소에서 validation 마커 제거
                elementRegistry.getAll().forEach(el => {
                    try { canvas.removeMarker(el.id, 'validation-error-element'); } catch (e) { /* ignore */ }
                });

                this.validationOverlayIds = [];
                this.validationMarkerIds = [];
            } catch (e) {
                // modeler가 아직 초기화되지 않은 경우
            }
        },

        clearValidation() {
            this.clearValidationOverlays();
            this.validationResults = [];
            this.validationDialog = false;
        },

        focusElement(elementId) {
            if (!elementId) return;
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            try {
                const canvas = modeler.get('canvas');
                const elementRegistry = modeler.get('elementRegistry');
                const element = elementRegistry.get(elementId);
                if (element) {
                    // 해당 element로 뷰포트 이동
                    canvas.scrollToElement(element);
                    // 선택
                    const selection = modeler.get('selection');
                    if (selection) selection.select(element);
                }
            } catch (e) {
                // ignore
            }
        },

        createOverlayHtml(errors) {
            const container = document.createElement('div');
            container.style.cssText = `
                display: flex;
                align-items: flex-start;
                gap: 8px;
                background: #fff;
                border: 1px solid #ffcdd2;
                border-radius: 8px;
                padding: 8px 12px;
                box-shadow: 0 2px 12px rgba(0,0,0,0.12);
                white-space: nowrap;
                pointer-events: auto;
                cursor: pointer;
                min-width: 140px;
                z-index: 100;
            `;

            const dot = document.createElement('div');
            dot.style.cssText = `
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: #f44336;
                margin-top: 2px;
                flex-shrink: 0;
            `;
            container.appendChild(dot);

            const content = document.createElement('div');

            const title = document.createElement('div');
            title.style.cssText = 'font-size: 12px; font-weight: 600; color: #f44336; line-height: 1.3;';
            title.textContent = this.$t('validation.validationError') || 'Validation Error';
            content.appendChild(title);

            // 각 에러 메시지 표시
            errors.forEach(err => {
                const msg = document.createElement('div');
                msg.style.cssText = 'font-size: 11px; color: #666; line-height: 1.4;';
                msg.textContent = err.shortMessage || err.message;
                content.appendChild(msg);
            });

            container.appendChild(content);
            return container;
        },

        async handleValidate() {
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            // 이전 오버레이 제거
            this.clearValidationOverlays();

            const results = [];

            try {
                const elementRegistry = modeler.get('elementRegistry');
                const overlays = modeler.get('overlays');
                const canvas = modeler.get('canvas');
                // label 요소와 root 요소를 필터링하여 중복 오버레이 방지
                const allElements = elementRegistry.getAll().filter(el =>
                    el.type !== 'label' && !el.labelTarget
                );

                let hasStartEvent = false;
                let hasEndEvent = false;

                // connections map 생성
                const connections = new Map();
                allElements.forEach(el => {
                    if (el.id) {
                        connections.set(el.id, {
                            incoming: (el.incoming || []).map(c => c.source?.id).filter(Boolean),
                            outgoing: (el.outgoing || []).map(c => c.target?.id).filter(Boolean)
                        });
                    }
                });

                const processedIds = new Set();
                allElements.forEach(element => {
                    // 같은 ID 중복 처리 방지
                    if (processedIds.has(element.id)) return;
                    processedIds.add(element.id);
                    const type = element.type;
                    if (type === 'bpmn:StartEvent') hasStartEvent = true;
                    if (type === 'bpmn:EndEvent') hasEndEvent = true;

                    const elementErrors = [];

                    // W001: 이름 없는 태스크
                    if (type?.includes('Task')) {
                        const name = element.businessObject?.name;
                        if (!name || !name.trim()) {
                            elementErrors.push({
                                level: 'warning',
                                message: this.$t('validation.unnamedTask') || 'Task has no name.',
                                shortMessage: this.$t('validation.nameRequired') || 'Name Required',
                            });
                        }
                    }

                    // W002: 들어오는 연결 없음
                    if ((type?.includes('Task') || type?.includes('Gateway')) && type !== 'bpmn:StartEvent') {
                        const conn = connections.get(element.id);
                        if (!conn || conn.incoming.length === 0) {
                            elementErrors.push({
                                level: 'warning',
                                message: this.$t('validation.noIncomingConnection') || 'No incoming connection.',
                                shortMessage: this.$t('validation.connectionMissing') || 'Connection Missing',
                            });
                        }
                    }

                    // W003: 나가는 연결 없음
                    if ((type?.includes('Task') || type?.includes('Gateway')) && type !== 'bpmn:EndEvent') {
                        const conn = connections.get(element.id);
                        if (!conn || conn.outgoing.length === 0) {
                            elementErrors.push({
                                level: 'warning',
                                message: this.$t('validation.noOutgoingConnection') || 'No outgoing connection.',
                                shortMessage: this.$t('validation.connectionMissing') || 'Connection Missing',
                            });
                        }
                    }

                    // W004: 게이트웨이 분기 부족
                    if (type?.includes('Gateway')) {
                        const conn = connections.get(element.id);
                        if (conn) {
                            const isJoin = conn.incoming.length > 1;
                            const isSplit = conn.outgoing.length > 1;
                            if (!isJoin && !isSplit) {
                                elementErrors.push({
                                    level: 'warning',
                                    message: this.$t('validation.gatewayNeedsBranches') || 'Gateway needs at least 2 branches.',
                                    shortMessage: this.$t('validation.branchingRequired') || 'Branching Required',
                                });
                            }
                        }
                    }

                    // W005: 레인 담당자 없음
                    if (type === 'bpmn:Lane') {
                        const name = element.businessObject?.name || '';
                        if (!name.trim() || name === 'Lane' || name === 'Lane 1') {
                            elementErrors.push({
                                level: 'warning',
                                message: this.$t('validation.noLaneAssignee') || 'Lane has no assignee.',
                                shortMessage: this.$t('validation.assigneeRequired') || 'Assignee Required',
                            });
                        }
                    }

                    // W006: 게이트웨이 분기 조건 누락
                    if (type === 'bpmn:SequenceFlow') {
                        const source = element.source;
                        if (source?.type === 'bpmn:ExclusiveGateway' || source?.type === 'bpmn:InclusiveGateway') {
                            const isDefault = source.businessObject?.default?.id === element.id;
                            if (!isDefault) {
                                const condition = element.businessObject?.conditionExpression;
                                if (!condition) {
                                    elementErrors.push({
                                        level: 'warning',
                                        message: this.$t('validation.missingCondition') || 'Condition expression is missing.',
                                        shortMessage: this.$t('validation.conditionMissing') || 'Condition Missing',
                                    });
                                }
                            }
                        }
                    }

                    // element에 에러가 있으면 오버레이 추가
                    if (elementErrors.length > 0) {
                        // 마커 추가 (빨간 테두리)
                        try {
                            canvas.addMarker(element.id, 'validation-error-element');
                            this.validationMarkerIds.push(element.id);
                        } catch (e) { /* ignore */ }

                        // 오버레이 추가 (에러 메시지 말풍선)
                        try {
                            const overlayHtml = this.createOverlayHtml(elementErrors);
                            const overlayId = overlays.add(element.id, 'validation-error', {
                                position: {
                                    top: -12,
                                    left: (element.width || 100) + 8
                                },
                                html: overlayHtml
                            });
                            this.validationOverlayIds.push(overlayId);
                        } catch (e) {
                            console.warn('Failed to add overlay for', element.id, e);
                        }

                        // 결과 목록에 추가
                        elementErrors.forEach(err => {
                            results.push({
                                ...err,
                                elementName: element.businessObject?.name || element.id,
                                elementId: element.id,
                            });
                        });
                    }
                });

                // 프로세스 레벨 에러
                if (!hasStartEvent) {
                    results.push({
                        level: 'error',
                        message: this.$t('validation.noStartEvent') || 'No start event found.',
                    });
                }
                if (!hasEndEvent) {
                    results.push({
                        level: 'error',
                        message: this.$t('validation.noEndEvent') || 'No end event found.',
                    });
                }
            } catch (e) {
                console.error('Validation error:', e);
            }

            if (results.length > 0) {
                this.validationResults = results;
                this.validationDialog = true;
            } else {
                if (this.$toast) {
                    this.$toast.success(this.$t('processHierarchy.validationPassed') || '검증 통과');
                }
            }
        },
    },
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
    stroke: #f44336 !important;
    stroke-width: 2.5px !important;
}
.validation-error-element .djs-outline {
    stroke: #f44336 !important;
    stroke-width: 1px !important;
    stroke-dasharray: 4 3;
}
</style>

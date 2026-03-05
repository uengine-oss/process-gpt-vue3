<template>
    <div class="hierarchy-designer">
        <!-- Header Toolbar -->
        <div class="designer-toolbar">
            <div class="toolbar-left">
                <template v-if="processName">
                    <span class="process-name font-weight-bold">{{ processName }}</span>
                    <ProgressBadge v-if="currentStatus" type="status" :status="currentStatus" size="x-small" class="ml-2" />
                    <span v-if="currentVersion" class="text-caption text-medium-emphasis ml-2"> v{{ currentVersion }} </span>
                    <v-chip v-if="toBeMode" color="purple" variant="flat" size="small" class="ml-3"> To-Be Mode </v-chip>
                </template>
                <span v-else class="text-medium-emphasis">
                    {{ $t('processHierarchy.selectProcess') || '왼쪽 트리에서 프로세스를 선택하세요' }}
                </span>
            </div>
            <div class="toolbar-right">
                <!-- As-Is / To-Be Mode Toggle -->
                <v-btn-toggle v-model="activeMode" mandatory density="compact" variant="outlined" divided color="purple" class="mr-2">
                    <v-btn value="as-is" size="small" :disabled="!processName"> As-Is </v-btn>
                    <v-btn value="to-be" size="small" :disabled="!processName"> To-Be </v-btn>
                </v-btn-toggle>
                <v-divider vertical class="mx-1" />
                <v-btn variant="text" size="small" :disabled="!processName" @click="$emit('save')">
                    <v-icon start size="16">mdi-content-save</v-icon>
                    {{ $t('processHierarchy.save') || 'Save' }}
                </v-btn>
                <v-btn variant="text" size="small" :disabled="!processName" @click="handleValidate">
                    <v-icon start size="16">mdi-check-circle-outline</v-icon>
                    {{ $t('processHierarchy.validate') || 'Validate' }}
                </v-btn>
                <v-divider vertical class="mx-1" />
                <v-btn
                    :variant="isWip ? 'flat' : 'text'"
                    :color="isWip ? 'purple' : undefined"
                    size="small"
                    :disabled="!processName"
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

        <!-- Recovery Banner -->
        <v-alert
            v-if="recoveryBackup"
            type="warning"
            variant="tonal"
            density="compact"
            closable
            class="mx-2 mt-1 mb-0"
            style="flex-shrink: 0"
            @click:close="$emit('dismissBackup')"
        >
            <div class="d-flex align-center justify-space-between">
                <span class="text-body-2">
                    저장되지 않은 로컬 백업이 발견되었습니다.
                    <span class="text-caption text-medium-emphasis ml-1">
                        ({{ new Date(recoveryBackup.timestamp).toLocaleString() }})
                    </span>
                </span>
                <v-btn size="small" variant="flat" color="warning" class="ml-3" @click="$emit('recoverBackup')"> 복구 </v-btn>
            </div>
        </v-alert>

        <!-- BPMN Canvas -->
        <div class="designer-canvas" v-show="bpmn" :style="canvasMinHeight ? { minHeight: canvasMinHeight + 'px' } : {}">
            <div :class="{ 'canvas-blurred': toBeMode && !hasToBeBlueprint }">
                <BpmnuEngine
                    ref="bpmnVue"
                    :key="bpmnKey"
                    :bpmn="activeBpmn"
                    :isViewMode="false"
                    @openPanel="(id) => $emit('openPanel', id)"
                    @update-xml="(val) => $emit('updateXml', val)"
                    @definition="(def) => $emit('definition', def)"
                    @done="onBpmnDone"
                />
            </div>

            <!-- [2.3.3] Coordinate Anchor Overlay -->
            <div v-if="bpmn && viewboxInfo" class="coord-anchor">
                x: {{ viewboxInfo.x }} y: {{ viewboxInfo.y }} | {{ viewboxInfo.zoom }}%
            </div>

            <!-- To-Be Blueprint Empty State Overlay -->
            <div v-if="toBeMode && !hasToBeBlueprint" class="tobe-overlay">
                <div class="tobe-overlay-card">
                    <v-icon size="48" color="purple">mdi-creation</v-icon>
                    <div class="tobe-overlay-title mt-4">아직 기획된 To-Be 청사진이 없습니다.</div>
                    <div class="tobe-overlay-subtitle mt-2">현재 프로세스를 바탕으로 새로운 개선안 설계를 시작해 보세요.</div>
                    <v-btn color="purple" variant="flat" size="large" rounded="lg" class="mt-6 tobe-cta-btn" @click="createToBeBlueprint">
                        + 차기 청사진(Blueprint) 생성하기
                    </v-btn>
                </div>
            </div>
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
        recoveryBackup: { type: Object, default: null }
    },
    emits: [
        'openPanel',
        'updateXml',
        'save',
        'clone',
        'versionHistory',
        'definition',
        'toggleWip',
        'validationDone',
        'dismissBackup',
        'recoverBackup'
    ],
    beforeUnmount() {
        // 전역 상태 정리 — 다른 페이지에 영향 방지
        window.$bpmnTimeTravel = null;

        // [2.3.3] Cleanup viewbox listener
        if (this._viewboxHandler) {
            try {
                const store = useBpmnStore();
                const modeler = store.getModeler;
                if (modeler) {
                    const canvas = modeler.get('canvas');
                    canvas.off('viewbox.changed', this._viewboxHandler);
                }
            } catch (e) {
                /* ignore */
            }
            this._viewboxHandler = null;
        }
    },
    data() {
        return {
            bpmnKey: 0,
            validationDialog: false,
            validationResults: [],
            validationOverlayIds: [],
            validationMarkerIds: [],
            activeMode: 'as-is',
            toBeBlueprintXml: '',
            asIsXmlSnapshot: '', // As-Is XML 스냅샷 (To-Be 전환 시 현재 상태 보존)
            switchingMode: false, // 모드 전환 중 플래그
            viewboxInfo: null,
            _viewboxHandler: null,
            canvasMinHeight: 0,
            _expandDebounceTimer: null
        };
    },
    computed: {
        toBeMode() {
            return this.activeMode === 'to-be';
        },
        hasToBeBlueprint() {
            return !!this.toBeBlueprintXml;
        },
        /** 캔버스에 로드할 실제 XML */
        activeBpmn() {
            if (this.switchingMode) return null; // 전환 중 무시
            return this.toBeMode && this.hasToBeBlueprint ? this.toBeBlueprintXml : this.bpmn;
        },
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
        }
    },
    watch: {
        async bpmn(newVal, oldVal) {
            if (newVal !== oldVal && newVal) {
                // 프로세스 전환 전에 To-Be 편집 중이었으면 persist
                if (this.toBeMode && this.toBeBlueprintXml && oldVal) {
                    const currentXml = await this.getCurrentXml();
                    if (currentXml) {
                        await this.persistToBeBpmn(currentXml);
                    }
                }
                this.bpmnKey++;
                this.validationOverlayIds = [];
                this.validationMarkerIds = [];
                // 프로세스 변경 시 To-Be 상태 초기화
                this.activeMode = 'as-is';
                this.asIsXmlSnapshot = '';
                this.switchingMode = false;
                window.$bpmnTimeTravel = null;
                // definition에서 저장된 tobe_bpmn 로드
                const savedToBe = this.processDefinition?.definition?.tobe_bpmn;
                this.toBeBlueprintXml = savedToBe || '';
            }
        },
        async activeMode(newMode, oldMode) {
            if (!this.bpmn || this.switchingMode) return;
            this.switchingMode = true;

            try {
                // 현재 캔버스의 최신 XML 스냅샷 저장
                const currentXml = await this.getCurrentXml();

                if (oldMode === 'as-is' && newMode === 'to-be') {
                    // As-Is → To-Be: As-Is 상태 보존
                    if (currentXml) this.asIsXmlSnapshot = currentXml;
                    // To-Be blueprint가 있으면 캔버스를 교체
                    if (this.hasToBeBlueprint) {
                        this.bpmnKey++;
                    }
                    // timeTravel 모드 설정
                    window.$bpmnTimeTravel = 'toBe';
                } else if (oldMode === 'to-be' && newMode === 'as-is') {
                    // To-Be → As-Is: To-Be 상태 보존 + DB persist
                    if (currentXml && this.hasToBeBlueprint) {
                        this.toBeBlueprintXml = currentXml;
                        this.persistToBeBpmn(currentXml);
                    }
                    // As-Is로 복원
                    this.bpmnKey++;
                    window.$bpmnTimeTravel = null;
                }
            } finally {
                this.$nextTick(() => {
                    this.switchingMode = false;
                });
            }
        }
    },
    methods: {
        /** 현재 modeler에서 최신 XML 추출 */
        async getCurrentXml() {
            try {
                const store = useBpmnStore();
                const modeler = store.getModeler;
                if (!modeler) return null;
                const { xml } = await modeler.saveXML({ format: true, preamble: true });
                return xml;
            } catch {
                return null;
            }
        },

        /** To-Be XML을 definition.tobe_bpmn에 즉시 persist (모드 전환 시 유실 방지) */
        async persistToBeBpmn(xml) {
            if (!xml || !this.definitionPath) return;
            try {
                const supabase = window.$supabase;
                if (!supabase) return;
                const currentDef = this.processDefinition?.definition || {};
                const updatedDef = { ...currentDef, tobe_bpmn: xml };
                await supabase.from('proc_def').update({ definition: updatedDef }).eq('id', this.definitionPath);
                // 로컬 동기화
                if (this.processDefinition) {
                    this.processDefinition.definition = updatedDef;
                }
            } catch (e) {
                console.warn('To-Be auto-persist failed:', e);
            }
        },

        createToBeBlueprint() {
            // As-Is XML을 복사하여 To-Be 시작점으로 사용
            this.toBeBlueprintXml = this.bpmn || '';
            // bpmnKey 갱신으로 캔버스 리로드 (overlay 사라짐)
            this.bpmnKey++;
        },

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

                // [2.3.3] Coordinate anchor - listen to viewbox changes
                const store2 = useBpmnStore();
                const modeler2 = store2.getModeler;
                if (modeler2) {
                    try {
                        const canvas2 = modeler2.get('canvas');
                        this._viewboxHandler = () => {
                            try {
                                const vb = canvas2.viewbox();
                                this.viewboxInfo = {
                                    x: Math.round(vb.x),
                                    y: Math.round(vb.y),
                                    zoom: Math.round((vb.scale || 1) * 100)
                                };
                            } catch (e) {
                                /* ignore */
                            }
                        };
                        canvas2.on('viewbox.changed', this._viewboxHandler);
                        // Initial read
                        this._viewboxHandler();
                    } catch (e) {
                        /* ignore */
                    }

                    // [2.3.1] Canvas auto-expand on content overflow
                    try {
                        const eventBus = modeler2.get('eventBus');
                        const checkCanvasExpand = () => {
                            if (this._expandDebounceTimer) clearTimeout(this._expandDebounceTimer);
                            this._expandDebounceTimer = setTimeout(() => {
                                this.checkAndExpandCanvas();
                            }, 300);
                        };
                        eventBus.on('commandStack.changed', checkCanvasExpand);
                    } catch (e) {
                        /* ignore */
                    }
                }
            });
        },

        checkAndExpandCanvas() {
            try {
                const store = useBpmnStore();
                const modeler = store.getModeler;
                if (!modeler) return;
                const elementRegistry = modeler.get('elementRegistry');
                const allElements = elementRegistry.getAll();

                let maxY = 0;
                allElements.forEach((el) => {
                    if (el.y !== undefined && el.height !== undefined) {
                        const bottom = el.y + el.height;
                        if (bottom > maxY) maxY = bottom;
                    }
                });

                // Get container height
                const container = this.$el?.querySelector('.designer-canvas');
                if (!container) return;
                const containerHeight = container.clientHeight;

                // If content exceeds container, expand in 500px increments (max 5000px)
                if (maxY > containerHeight - 100) {
                    const needed = Math.ceil(maxY / 500) * 500 + 500;
                    this.canvasMinHeight = Math.min(needed, 5000);
                }
            } catch (e) {
                // ignore
            }
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

                // 모든 요소에서 validation 마커 제거
                elementRegistry.getAll().forEach((el) => {
                    try {
                        canvas.removeMarker(el.id, 'validation-error-element');
                    } catch (e) {
                        /* ignore */
                    }
                    try {
                        canvas.removeMarker(el.id, 'validation-blink-error');
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
            errors.forEach((err) => {
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
                const allElements = elementRegistry.getAll().filter((el) => el.type !== 'label' && !el.labelTarget);

                let hasStartEvent = false;
                let hasEndEvent = false;

                // connections map 생성
                const connections = new Map();
                allElements.forEach((el) => {
                    if (el.id) {
                        connections.set(el.id, {
                            incoming: (el.incoming || []).map((c) => c.source?.id).filter(Boolean),
                            outgoing: (el.outgoing || []).map((c) => c.target?.id).filter(Boolean)
                        });
                    }
                });

                const processedIds = new Set();
                allElements.forEach((element) => {
                    // 같은 ID 중복 처리 방지
                    if (processedIds.has(element.id)) return;
                    processedIds.add(element.id);
                    const type = element.type;
                    if (type === 'bpmn:StartEvent') hasStartEvent = true;
                    if (type === 'bpmn:EndEvent') hasEndEvent = true;

                    const elementErrors = [];

                    // E003: 완전 고립 노드 (incoming + outgoing 모두 없음) → ERROR
                    if ((type?.includes('Task') || type?.includes('Gateway')) && type !== 'bpmn:StartEvent' && type !== 'bpmn:EndEvent') {
                        const conn = connections.get(element.id);
                        if (!conn || (conn.incoming.length === 0 && conn.outgoing.length === 0)) {
                            elementErrors.push({
                                level: 'error',
                                message: this.$t('validation.isolatedNode') || 'Isolated node: no connections at all.',
                                shortMessage: this.$t('validation.isolated') || 'Isolated'
                            });
                        }
                    }

                    // E004: Dangling SequenceFlow
                    if (type === 'bpmn:SequenceFlow') {
                        const bo = element.businessObject;
                        if (!bo?.sourceRef || !bo?.targetRef) {
                            elementErrors.push({
                                level: 'error',
                                message: this.$t('validation.danglingFlow') || 'Dangling flow: missing source or target.',
                                shortMessage: this.$t('validation.dangling') || 'Dangling Flow'
                            });
                        }
                    }

                    // W001: 이름 없는 태스크
                    if (type?.includes('Task')) {
                        const name = element.businessObject?.name;
                        if (!name || !name.trim()) {
                            elementErrors.push({
                                level: 'warning',
                                message: this.$t('validation.unnamedTask') || 'Task has no name.',
                                shortMessage: this.$t('validation.nameRequired') || 'Name Required'
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
                                shortMessage: this.$t('validation.connectionMissing') || 'Connection Missing'
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
                                shortMessage: this.$t('validation.connectionMissing') || 'Connection Missing'
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
                                    shortMessage: this.$t('validation.branchingRequired') || 'Branching Required'
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
                                shortMessage: this.$t('validation.assigneeRequired') || 'Assignee Required'
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
                                        shortMessage: this.$t('validation.conditionMissing') || 'Condition Missing'
                                    });
                                    // [4.4.5] Gateway 자체에 ⚠️ 뱃지 오버레이
                                    if (source && !processedIds.has('gateway-badge-' + source.id)) {
                                        processedIds.add('gateway-badge-' + source.id);
                                        try {
                                            const badgeHtml = document.createElement('div');
                                            badgeHtml.className = 'gateway-warning-badge';
                                            badgeHtml.textContent = '⚠️';
                                            badgeHtml.style.cssText = 'font-size:16px;cursor:pointer;';
                                            badgeHtml.title = this.$t('validation.missingCondition') || 'Condition expression is missing';
                                            const badgeId = overlays.add(source.id, 'validation-error', {
                                                position: { top: -8, right: -8 },
                                                html: badgeHtml
                                            });
                                            this.validationOverlayIds.push(badgeId);
                                        } catch (e) {
                                            /* ignore */
                                        }
                                    }
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
                        } catch (e) {
                            /* ignore */
                        }

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
                        elementErrors.forEach((err) => {
                            results.push({
                                ...err,
                                elementName: element.businessObject?.name || element.id,
                                elementId: element.id
                            });
                        });
                    }
                });

                // [4.4.4] 프로세스 레벨 에러 → Pool/Lane 붉은 점멸
                if (!hasStartEvent || !hasEndEvent) {
                    // Pool/Participant 요소에 점멸 마커 적용
                    const poolElements = allElements.filter((el) => el.type === 'bpmn:Participant' || el.type === 'bpmn:Process');
                    poolElements.forEach((pool) => {
                        try {
                            canvas.addMarker(pool.id, 'validation-blink-error');
                            this.validationMarkerIds.push(pool.id);
                        } catch (e) {
                            /* ignore */
                        }
                    });
                    // Lane 요소에도 점멸 마커 적용
                    const laneElements = allElements.filter((el) => el.type === 'bpmn:Lane');
                    laneElements.forEach((lane) => {
                        try {
                            canvas.addMarker(lane.id, 'validation-blink-error');
                            this.validationMarkerIds.push(lane.id);
                        } catch (e) {
                            /* ignore */
                        }
                    });
                }
                if (!hasStartEvent) {
                    results.push({
                        level: 'error',
                        message: this.$t('validation.noStartEvent') || 'No start event found.'
                    });
                }
                if (!hasEndEvent) {
                    results.push({
                        level: 'error',
                        message: this.$t('validation.noEndEvent') || 'No end event found.'
                    });
                }
            } catch (e) {
                console.error('Validation error:', e);
            }

            // [3.1.3] 검증 결과 emit (에러 레벨 포함)
            this.$emit('validationDone', results);

            if (results.length > 0) {
                this.validationResults = results;
                this.validationDialog = true;
            } else {
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
.designer-canvas > div {
    height: 100%;
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

/* To-Be Blueprint Overlay */
.canvas-blurred {
    filter: blur(3px);
    opacity: 0.4;
    pointer-events: none;
    height: 100%;
}

.tobe-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.5);
    z-index: 10;
}

.tobe-overlay-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 48px 56px;
    background: #fff;
    border-radius: 16px;
    max-width: 480px;
}

.tobe-overlay-title {
    font-size: 18px;
    font-weight: 700;
    color: #212121;
    line-height: 1.4;
}

.tobe-overlay-subtitle {
    font-size: 14px;
    color: #757575;
    line-height: 1.5;
}

.tobe-cta-btn {
    min-width: 320px;
    font-weight: 600;
    letter-spacing: -0.2px;
}

.coord-anchor {
    position: absolute;
    bottom: 12px;
    left: 12px;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 11px;
    font-family: monospace;
    color: #666;
    z-index: 5;
    pointer-events: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
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

/* [4.4.4] Pool/Lane 붉은 점멸 애니메이션 */
@keyframes validation-blink {
    0%,
    100% {
        stroke: #f44336;
        stroke-opacity: 1;
    }
    50% {
        stroke: #f44336;
        stroke-opacity: 0.2;
    }
}
.validation-blink-error .djs-visual > :nth-child(1) {
    animation: validation-blink 1.2s ease-in-out infinite !important;
    stroke: #f44336 !important;
    stroke-width: 2.5px !important;
}
</style>

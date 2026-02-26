<template>
    <div class="version-comparison-page">
        <!-- Header Bar -->
        <div class="comparison-header">
            <div class="header-left">
                <v-btn variant="text" size="small" @click="goBack">
                    <v-icon start>mdi-arrow-left</v-icon>
                    {{ $t('versionComparison.back') || 'Back' }}
                </v-btn>
                <v-icon class="mx-2" size="20">mdi-compare-horizontal</v-icon>
                <span class="text-subtitle-1 font-weight-bold">
                    {{ $t('versionComparison.title') || 'Version Comparison' }}
                </span>
            </div>
            <div class="header-right">
                <v-btn
                    variant="outlined"
                    size="small"
                    :disabled="changes.length === 0"
                    @click="exportDiff"
                >
                    {{ $t('versionComparison.exportDiff') || 'Export Diff' }}
                </v-btn>
                <v-btn
                    color="primary"
                    size="small"
                    :disabled="!versionBData || selectedVersionB === '__current__'"
                    @click="applyChanges"
                >
                    <v-icon start size="16">mdi-backup-restore</v-icon>
                    {{ $t('versionComparison.rollback') || '이전 버전으로 되돌리기' }}
                </v-btn>
            </div>
        </div>

        <div class="comparison-body">
            <!-- Left Panel: Process Tree -->
            <div class="comparison-left-panel" :style="{ width: leftPanelWidth + 'px' }">
                <div class="tree-header">
                    <div class="text-subtitle-2 font-weight-medium pa-3 pb-1">
                        {{ $t('processHierarchy.title') || 'Process Hierarchy' }}
                    </div>
                    <div class="text-caption text-medium-emphasis px-3 pb-2">
                        {{ $t('versionComparison.selectProcess') || 'Select a detail process to compare' }}
                    </div>
                </div>
                <div class="tree-content">
                    <ProcessHierarchyTree
                        :procMap="procMap"
                        :metricsMap="metricsMap"
                        :definitionList="definitionList"
                        :selectedId="selectedProcessId"
                        @select="handleSelectProcess"
                        :hideHeader="true"
                    />
                </div>
                <div class="resize-handle" @mousedown="startResize"></div>
            </div>

            <!-- Center Panel: Two BPMN Viewers -->
            <div class="comparison-center-panel">
                <!-- 프로세스 미선택 시 통합 안내 메시지 -->
                <div v-if="!selectedProcessId" class="empty-process-placeholder">
                    <v-icon size="48" color="grey-lighten-1">mdi-file-compare</v-icon>
                    <div class="text-body-1 text-medium-emphasis mt-3">
                        {{ $t('versionComparison.selectProcessToCompare') || '비교할 프로세스를 왼쪽 목록에서 선택하세요' }}
                    </div>
                    <div class="text-caption text-medium-emphasis mt-1">
                        {{ $t('versionComparison.selectProcessHint') || '프로세스를 선택하면 버전 간 차이를 비교할 수 있습니다' }}
                    </div>
                </div>

                <!-- 프로세스 선택 후 비교 뷰 -->
                <template v-else>
                    <!-- Version A (New) -->
                    <div class="version-panel">
                        <div class="version-bar">
                            <div class="version-bar-left">
                                <span class="version-badge badge-new">
                                    {{ $t('versionComparison.versionALabel') || 'Version A (New)' }}
                                </span>
                                <v-select
                                    v-model="selectedVersionA"
                                    :items="versionItems"
                                    item-title="title"
                                    item-value="value"
                                    density="compact"
                                    variant="outlined"
                                    hide-details
                                    class="version-select ml-3"
                                    :disabled="versions.length === 0"
                                    @update:model-value="loadVersionA"
                                />
                                <span v-if="selectedProcessName" class="text-body-2 ml-3">
                                    {{ selectedProcessName }}
                                </span>
                            </div>
                            <div class="version-bar-right text-caption text-medium-emphasis">
                                <template v-if="versionAData">
                                    <v-icon size="14" class="mr-1">mdi-calendar</v-icon>
                                    {{ formatDate(versionAData.timeStamp) }}
                                    <span class="ml-3">{{ versionAData.owner || '' }}</span>
                                </template>
                            </div>
                        </div>
                        <div class="version-canvas">
                            <BpmnUengineViewer
                                v-if="versionAXml"
                                ref="viewerA"
                                :key="'a-' + viewerKeyA"
                                :bpmn="versionAXml"
                                :diffActivities="diffActivitiesA"
                                @rendered="onViewerRendered($refs.viewerA)"
                            />
                            <div v-else class="empty-version">
                                <v-icon size="32" color="grey-lighten-1">mdi-file-document-outline</v-icon>
                                <div class="text-caption text-medium-emphasis mt-2">
                                    {{ $t('versionComparison.noVersions') || '저장된 버전이 없습니다' }}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Divider -->
                    <v-divider />

                    <!-- Version B (Old) -->
                    <div class="version-panel">
                        <div class="version-bar">
                            <div class="version-bar-left">
                                <span class="version-badge badge-old">
                                    {{ $t('versionComparison.versionBLabel') || 'Version B (Old)' }}
                                </span>
                                <v-select
                                    v-model="selectedVersionB"
                                    :items="versionItems"
                                    item-title="title"
                                    item-value="value"
                                    density="compact"
                                    variant="outlined"
                                    hide-details
                                    class="version-select ml-3"
                                    :disabled="versions.length === 0"
                                    @update:model-value="loadVersionB"
                                />
                                <span v-if="selectedProcessName" class="text-body-2 ml-3">
                                    {{ selectedProcessName }}
                                </span>
                            </div>
                            <div class="version-bar-right text-caption text-medium-emphasis">
                                <template v-if="versionBData">
                                    <v-icon size="14" class="mr-1">mdi-calendar</v-icon>
                                    {{ formatDate(versionBData.timeStamp) }}
                                    <span class="ml-3">{{ versionBData.owner || '' }}</span>
                                </template>
                            </div>
                        </div>
                        <div class="version-canvas">
                            <BpmnUengineViewer
                                v-if="versionBXml"
                                ref="viewerB"
                                :key="'b-' + viewerKeyB"
                                :bpmn="versionBXml"
                                :diffActivities="diffActivitiesB"
                                @rendered="onViewerRendered($refs.viewerB)"
                            />
                            <div v-else class="empty-version">
                                <v-icon size="32" color="grey-lighten-1">mdi-file-document-outline</v-icon>
                                <div class="text-caption text-medium-emphasis mt-2">
                                    {{ $t('versionComparison.noVersions') || '저장된 버전이 없습니다' }}
                                </div>
                            </div>
                        </div>
                    </div>
                </template>
            </div>

            <!-- Right Panel: Visual Diff -->
            <div class="comparison-right-panel">
                <div class="diff-header pa-4 pb-2">
                    <div class="text-subtitle-1 font-weight-bold">
                        {{ $t('versionComparison.visualDiff') || 'Visual Diff' }}
                    </div>
                    <div class="diff-legend mt-2">
                        <span class="legend-item">
                            <span class="legend-dot dot-added"></span>
                            {{ $t('versionComparison.added') || '+ Added' }}
                        </span>
                        <span class="legend-item">
                            <span class="legend-dot dot-modified"></span>
                            {{ $t('versionComparison.modified') || '≠ Modified' }}
                        </span>
                        <span class="legend-item">
                            <span class="legend-dot dot-removed"></span>
                            {{ $t('versionComparison.removed') || '- Removed' }}
                        </span>
                    </div>
                </div>

                <v-divider />

                <div class="diff-list" v-if="changes.length > 0">
                    <div
                        v-for="(change, i) in changes"
                        :key="i"
                        class="diff-item pa-3"
                    >
                        <span
                            class="diff-badge"
                            :class="'diff-badge-' + change.type"
                        >
                            {{ change.type }}
                        </span>
                        <div class="diff-item-content mt-1">
                            <div class="text-body-2 font-weight-medium">
                                {{ formatElementType(change.elementType) }}: {{ change.name || change.id }}
                            </div>
                            <div class="text-caption text-medium-emphasis" v-if="change.description">
                                {{ change.description }}
                            </div>
                        </div>
                    </div>
                </div>
                <div v-else-if="versionAXml && versionBXml" class="pa-4 text-center">
                    <v-icon size="32" color="grey-lighten-1">mdi-check-circle-outline</v-icon>
                    <div class="text-caption text-medium-emphasis mt-2">
                        {{ $t('versionComparison.noChanges') || 'No differences found' }}
                    </div>
                </div>
                <div v-else class="pa-4 text-center">
                    <div class="text-caption text-medium-emphasis">
                        {{ $t('versionComparison.selectTwoVersions') || 'Select two versions to compare' }}
                    </div>
                </div>

                <!-- Loading indicator for diff -->
                <div v-if="diffLoading" class="pa-4 text-center">
                    <v-progress-circular indeterminate size="24" width="2" color="primary" />
                    <div class="text-caption text-medium-emphasis mt-2">Comparing...</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import ProcessHierarchyTree from './ProcessHierarchyTree.vue';
import BpmnUengineViewer from '@/components/BpmnUengineViewer.vue';

const backend = BackendFactory.createBackend();
const storage = StorageBaseFactory.getStorage();

/**
 * BPMN XML에서 element 목록 추출 (구조적 비교용)
 */
const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';

function extractBpmnElements(xml) {
    if (!xml) return [];
    const elements = [];
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');

        const relevantSelectors = [
            'task', 'userTask', 'serviceTask', 'manualTask', 'scriptTask', 'sendTask', 'receiveTask', 'businessRuleTask',
            'startEvent', 'endEvent', 'intermediateThrowEvent', 'intermediateCatchEvent', 'boundaryEvent',
            'exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway',
            'subProcess', 'callActivity',
            'sequenceFlow',
            'participant', 'lane'
        ];

        relevantSelectors.forEach(tag => {
            // getElementsByTagNameNS로 네임스페이스 정확히 처리
            const found = doc.getElementsByTagNameNS(BPMN_NS, tag);
            for (let i = 0; i < found.length; i++) {
                const el = found[i];
                const id = el.getAttribute('id');
                if (!id) continue;
                const name = el.getAttribute('name') || '';
                const sourceRef = el.getAttribute('sourceRef') || '';
                const targetRef = el.getAttribute('targetRef') || '';
                const attrs = {};
                for (let a = 0; a < el.attributes.length; a++) {
                    const attr = el.attributes[a];
                    if (attr.name !== 'id' && !attr.name.startsWith('xmlns')) {
                        attrs[attr.name] = attr.value;
                    }
                }
                // lane의 flowNodeRef 자식 요소 포함 (레인 멤버십 변경 감지)
                if (tag === 'lane') {
                    const flowNodeRefs = el.getElementsByTagNameNS(BPMN_NS, 'flowNodeRef');
                    const refs = [];
                    for (let r = 0; r < flowNodeRefs.length; r++) {
                        const refText = flowNodeRefs[r].textContent?.trim();
                        if (refText) refs.push(refText);
                    }
                    if (refs.length > 0) {
                        attrs['__flowNodeRefs'] = refs.sort().join(',');
                    }
                }
                elements.push({ id, name, elementType: tag, sourceRef, targetRef, attrs });
            }
        });
    } catch (e) {
        console.warn('extractBpmnElements failed:', e);
    }
    return elements;
}

/**
 * 두 BPMN XML 간의 구조적 diff 계산
 */
function computeBpmnDiff(oldXml, newXml) {
    const oldElements = extractBpmnElements(oldXml);
    const newElements = extractBpmnElements(newXml);

    const oldMap = new Map(oldElements.map(el => [el.id, el]));
    const newMap = new Map(newElements.map(el => [el.id, el]));

    const changes = [];
    const diffActivitiesA = {}; // Version A (new) 에 표시할 마커
    const diffActivitiesB = {}; // Version B (old) 에 표시할 마커

    // Added: Version A(new)에 있지만 Version B(old)에 없는 요소
    for (const [id, el] of newMap) {
        if (!oldMap.has(id)) {
            changes.push({
                type: 'added',
                id,
                name: el.name,
                elementType: el.elementType,
                description: buildDescription('added', el),
            });
            diffActivitiesA[id] = 'added';
        }
    }

    // Removed: Version B(old)에 있지만 Version A(new)에 없는 요소
    for (const [id, el] of oldMap) {
        if (!newMap.has(id)) {
            changes.push({
                type: 'removed',
                id,
                name: el.name,
                elementType: el.elementType,
                description: buildDescription('removed', el),
            });
            diffActivitiesB[id] = 'deleted';
        }
    }

    // Modified: 양쪽에 있지만 내용이 변경된 요소
    for (const [id, newEl] of newMap) {
        const oldEl = oldMap.get(id);
        if (oldEl) {
            // Lane: flowNodeRef 변경 시 lane이 아닌 이동한 요소를 마킹
            if (newEl.elementType === 'lane') {
                const oldRefs = new Set((oldEl.attrs['__flowNodeRefs'] || '').split(',').filter(Boolean));
                const newRefs = new Set((newEl.attrs['__flowNodeRefs'] || '').split(',').filter(Boolean));
                for (const ref of newRefs) {
                    if (!oldRefs.has(ref) && !diffActivitiesA[ref]) {
                        const movedEl = newMap.get(ref);
                        if (movedEl) {
                            diffActivitiesA[ref] = 'modified';
                            diffActivitiesB[ref] = 'modified';
                            changes.push({
                                type: 'modified',
                                id: ref,
                                name: movedEl.name || ref,
                                elementType: movedEl.elementType,
                                description: `Moved to ${newEl.name || 'another lane'}`,
                            });
                        }
                    }
                }
                const oldLaneAttrs = { ...oldEl.attrs };
                const newLaneAttrs = { ...newEl.attrs };
                delete oldLaneAttrs['__flowNodeRefs'];
                delete newLaneAttrs['__flowNodeRefs'];
                if (JSON.stringify(oldLaneAttrs) !== JSON.stringify(newLaneAttrs)) {
                    changes.push({
                        type: 'modified',
                        id,
                        name: newEl.name || oldEl.name,
                        elementType: newEl.elementType,
                        description: buildModifiedDescription(oldEl, newEl),
                    });
                    diffActivitiesA[id] = 'modified';
                    diffActivitiesB[id] = 'modified';
                }
                continue;
            }

            const oldAttrs = JSON.stringify(oldEl.attrs);
            const newAttrs = JSON.stringify(newEl.attrs);
            if (oldAttrs !== newAttrs) {
                changes.push({
                    type: 'modified',
                    id,
                    name: newEl.name || oldEl.name,
                    elementType: newEl.elementType,
                    description: buildModifiedDescription(oldEl, newEl),
                });
                diffActivitiesA[id] = 'modified';
                diffActivitiesB[id] = 'modified';
            }
        }
    }

    return { changes, diffActivitiesA, diffActivitiesB };
}

function buildDescription(type, el) {
    const typeName = formatElementTypeName(el.elementType);
    if (type === 'added') {
        if (el.elementType === 'sequenceFlow') {
            return `Added connection${el.name ? ': ' + el.name : ''}`;
        }
        return `Added ${typeName.toLowerCase()}${el.name ? ': ' + el.name : ''}`;
    }
    if (type === 'removed') {
        if (el.elementType === 'sequenceFlow') {
            return `Removed connection${el.name ? ': ' + el.name : ''}`;
        }
        return `Removed ${typeName.toLowerCase()}${el.name ? ': ' + el.name : ''}`;
    }
    return '';
}

function buildModifiedDescription(oldEl, newEl) {
    const parts = [];
    if (oldEl.name !== newEl.name) {
        parts.push(`Name changed: "${oldEl.name}" → "${newEl.name}"`);
    } else {
        parts.push(`Updated ${formatElementTypeName(newEl.elementType).toLowerCase()} properties`);
    }
    return parts.join('. ');
}

function formatElementTypeName(type) {
    const map = {
        'task': 'Task',
        'userTask': 'User Task',
        'serviceTask': 'Service Task',
        'manualTask': 'Manual Task',
        'scriptTask': 'Script Task',
        'sendTask': 'Send Task',
        'receiveTask': 'Receive Task',
        'businessRuleTask': 'Business Rule Task',
        'startEvent': 'Start Event',
        'endEvent': 'End Event',
        'intermediateThrowEvent': 'Intermediate Event',
        'intermediateCatchEvent': 'Intermediate Event',
        'boundaryEvent': 'Boundary Event',
        'exclusiveGateway': 'Gateway',
        'parallelGateway': 'Gateway',
        'inclusiveGateway': 'Gateway',
        'eventBasedGateway': 'Gateway',
        'complexGateway': 'Gateway',
        'subProcess': 'Sub Process',
        'callActivity': 'Call Activity',
        'sequenceFlow': 'Sequence Flow',
        'participant': 'Participant',
        'lane': 'Lane',
    };
    return map[type] || type;
}

export default {
    name: 'VersionComparison',
    components: {
        ProcessHierarchyTree,
        BpmnUengineViewer,
    },
    data() {
        return {
            // Tree data
            procMap: null,
            metricsMap: null,
            definitionList: [],

            // Selected process
            selectedProcessId: '',
            selectedProcessName: '',

            // Version data
            versions: [],
            selectedVersionA: null,
            selectedVersionB: null,
            versionAData: null,
            versionBData: null,
            versionAXml: '',
            versionBXml: '',
            viewerKeyA: 0,
            viewerKeyB: 0,

            // Diff results
            changes: [],
            diffActivitiesA: {},
            diffActivitiesB: {},
            diffLoading: false,

            // Layout
            leftPanelWidth: 240,
            resizing: false,
            resizeStartX: 0,
            resizeStartWidth: 0,
        };
    },
    computed: {
        versionItems() {
            const items = [];
            // "Current (latest saved)" 항목
            items.push({
                title: this.$t('versionComparison.currentVersion') || 'Current (latest)',
                value: '__current__',
            });
            // 버전 목록 (최신순)
            this.versions.forEach(v => {
                items.push({
                    title: `v${v.version}${v.version_tag === 'major' ? ' (major)' : ''}`,
                    value: v.version,
                });
            });
            return items;
        },
    },
    async mounted() {
        await this.loadInitialData();

        // URL query에서 processId 가져오기
        const processId = this.$route.query?.processId;
        if (processId) {
            const def = this.definitionList.find(d => d.id === processId || d.file_name === processId);
            if (def) {
                this.handleSelectProcess(processId, def.name || processId);
            }
        }

        window.addEventListener('mousemove', this.onResize);
        window.addEventListener('mouseup', this.stopResize);
    },
    beforeUnmount() {
        window.removeEventListener('mousemove', this.onResize);
        window.removeEventListener('mouseup', this.stopResize);
    },
    methods: {
        goBack() {
            this.$router.back();
        },

        async loadInitialData() {
            try {
                const [procMapResult, metricsResult, defList, versionList] = await Promise.all([
                    backend.getProcessDefinitionMap(),
                    backend.getMetricsMap(),
                    backend.listDefinition('', { match: { tenant_id: window.$tenantName } }),
                    storage.list('proc_def_version', {
                        sort: 'desc',
                        orderBy: 'timeStamp',
                    }),
                ]);
                this.procMap = procMapResult;
                this.metricsMap = metricsResult;

                // proc_def_version에서 각 정의의 최신 버전 추출
                const latestVersionMap = {};
                if (versionList && versionList.length > 0) {
                    versionList.forEach(v => {
                        const defId = v.proc_def_id;
                        if (!defId) return;
                        if (!latestVersionMap[defId]) {
                            latestVersionMap[defId] = v.version;
                        }
                    });
                }

                // definitionList에 version 정보 주입
                const defs = defList || [];
                defs.forEach(def => {
                    const id = def.id || def.file_name;
                    if (id && latestVersionMap[id]) {
                        def.version = latestVersionMap[id];
                    }
                });
                this.definitionList = defs;
            } catch (e) {
                console.error('Failed to load initial data:', e);
            }
        },

        async handleSelectProcess(id, name) {
            if (this.selectedProcessId === id) return;

            this.selectedProcessId = id;
            this.selectedProcessName = name;

            // 버전 초기화
            this.versions = [];
            this.selectedVersionA = null;
            this.selectedVersionB = null;
            this.versionAData = null;
            this.versionBData = null;
            this.versionAXml = '';
            this.versionBXml = '';
            this.changes = [];
            this.diffActivitiesA = {};
            this.diffActivitiesB = {};

            // 버전 목록 로드
            try {
                const versionList = await backend.getDefinitionVersions(id, {
                    sort: 'desc',
                    orderBy: 'version',
                });

                if (versionList && versionList.length > 0) {
                    // 버전 내림차순 정렬 (major.minor 각각 정수 비교)
                    this.versions = versionList.sort((a, b) => {
                        const [aMajor, aMinor] = String(a.version).split('.').map(Number);
                        const [bMajor, bMinor] = String(b.version).split('.').map(Number);
                        if (bMajor !== aMajor) return bMajor - aMajor;
                        return (bMinor || 0) - (aMinor || 0);
                    });

                    // 기본 선택: A = current, B = 가장 최신 버전
                    this.selectedVersionA = '__current__';
                    if (this.versions.length >= 1) {
                        this.selectedVersionB = this.versions[0].version;
                    }

                    await this.loadVersionA();
                    await this.loadVersionB();
                }
            } catch (e) {
                console.error('Failed to load versions:', e);
            }
        },

        async loadVersionA() {
            if (!this.selectedVersionA || !this.selectedProcessId) return;

            try {
                if (this.selectedVersionA === '__current__') {
                    // 최신 저장본
                    const def = this.definitionList.find(
                        d => d.id === this.selectedProcessId || d.file_name === this.selectedProcessId
                    );
                    this.versionAXml = def?.bpmn || '';
                    this.versionAData = {
                        version: 'current',
                        timeStamp: def?.updated_at || def?.created_at || '',
                        owner: def?.owner || '',
                    };
                } else {
                    const v = this.versions.find(
                        v => String(v.version) === String(this.selectedVersionA)
                    );
                    if (v) {
                        this.versionAXml = v.snapshot || '';
                        this.versionAData = v;
                    }
                }
                this.runDiff();
            } catch (e) {
                console.error('Failed to load version A:', e);
            }
        },

        async loadVersionB() {
            if (!this.selectedVersionB || !this.selectedProcessId) return;

            try {
                if (this.selectedVersionB === '__current__') {
                    const def = this.definitionList.find(
                        d => d.id === this.selectedProcessId || d.file_name === this.selectedProcessId
                    );
                    this.versionBXml = def?.bpmn || '';
                    this.versionBData = {
                        version: 'current',
                        timeStamp: def?.updated_at || def?.created_at || '',
                        owner: def?.owner || '',
                    };
                } else {
                    const v = this.versions.find(
                        v => String(v.version) === String(this.selectedVersionB)
                    );
                    if (v) {
                        this.versionBXml = v.snapshot || '';
                        this.versionBData = v;
                    }
                }
                this.runDiff();
            } catch (e) {
                console.error('Failed to load version B:', e);
            }
        },

        runDiff() {
            if (!this.versionAXml || !this.versionBXml) {
                this.changes = [];
                this.diffActivitiesA = {};
                this.diffActivitiesB = {};
                return;
            }

            this.diffLoading = true;

            // setTimeout으로 UI 업데이트 후 diff 계산
            setTimeout(() => {
                try {
                    const result = computeBpmnDiff(this.versionBXml, this.versionAXml);
                    this.changes = result.changes;
                    this.diffActivitiesA = result.diffActivitiesA;
                    this.diffActivitiesB = result.diffActivitiesB;

                    // viewer key 업데이트하여 diff 마커 적용 + 재렌더링
                    this.viewerKeyA++;
                    this.viewerKeyB++;
                } catch (e) {
                    console.error('Diff computation failed:', e);
                    this.changes = [];
                } finally {
                    this.diffLoading = false;
                }
            }, 100);
        },

        onViewerRendered(viewer) {
            // import.render.complete 후 레이아웃 안정화 대기 후 fit-viewport
            this.$nextTick(() => {
                setTimeout(() => {
                    if (viewer && viewer.bpmnViewer) {
                        try {
                            const canvas = viewer.bpmnViewer.get('canvas');
                            canvas.zoom('fit-viewport', 'auto');
                        } catch (e) {
                            // fallback
                        }
                    }
                }, 150);
            });
        },

        formatElementType(type) {
            return formatElementTypeName(type);
        },

        formatDate(timestamp) {
            if (!timestamp) return '';
            try {
                const date = new Date(timestamp);
                return date.toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                });
            } catch {
                return timestamp;
            }
        },

        exportDiff() {
            if (this.changes.length === 0) return;

            const lines = [];
            lines.push(`Version Comparison: ${this.selectedProcessName}`);
            lines.push(`Version A: ${this.selectedVersionA === '__current__' ? 'Current' : 'v' + this.selectedVersionA}`);
            lines.push(`Version B: ${this.selectedVersionB === '__current__' ? 'Current' : 'v' + this.selectedVersionB}`);
            lines.push('');
            lines.push('Changes:');
            this.changes.forEach(c => {
                lines.push(`  [${c.type.toUpperCase()}] ${this.formatElementType(c.elementType)}: ${c.name || c.id}`);
                if (c.description) lines.push(`    ${c.description}`);
            });

            const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `version-diff-${this.selectedProcessId}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        },

        async applyChanges() {
            // Version B(이전)의 XML로 현재 프로세스를 롤백
            if (!this.versionBXml || !this.selectedProcessId) return;

            const versionLabel = this.selectedVersionB === '__current__'
                ? 'Current'
                : 'v' + this.selectedVersionB;

            if (!confirm(
                (this.$t('versionComparison.rollbackConfirm') || '{version} 버전으로 되돌리시겠습니까?')
                    .replace('{version}', versionLabel)
            )) return;

            try {
                await backend.putRawDefinition(this.versionBXml, this.selectedProcessId, {
                    name: this.selectedProcessName,
                });
                if (this.$toast) {
                    this.$toast.success(
                        (this.$t('versionComparison.rollbackSuccess') || '{version} 버전으로 되돌렸습니다.')
                            .replace('{version}', versionLabel)
                    );
                }
            } catch (e) {
                console.error('Rollback failed:', e);
                if (this.$toast) {
                    this.$toast.error(this.$t('versionComparison.rollbackFailed') || '되돌리기에 실패했습니다.');
                }
            }
        },

        // Resize handlers
        startResize(e) {
            this.resizing = true;
            this.resizeStartX = e.clientX;
            this.resizeStartWidth = this.leftPanelWidth;
            e.preventDefault();
        },
        onResize(e) {
            if (!this.resizing) return;
            const diff = e.clientX - this.resizeStartX;
            this.leftPanelWidth = Math.max(180, Math.min(400, this.resizeStartWidth + diff));
        },
        stopResize() {
            this.resizing = false;
        },
    },
};
</script>

<style scoped>
.version-comparison-page {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 125px);
    background: #fafafa;
    overflow: hidden;
}

/* Header */
.comparison-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: #fff;
    border-bottom: 1px solid #e0e0e0;
    flex-shrink: 0;
}
.header-left {
    display: flex;
    align-items: center;
}
.header-right {
    display: flex;
    align-items: center;
    gap: 8px;
}

/* Body layout */
.comparison-body {
    display: flex;
    flex: 1;
    overflow: hidden;
}

/* Left Panel */
.comparison-left-panel {
    flex-shrink: 0;
    background: #fff;
    border-right: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
}
.tree-header {
    flex-shrink: 0;
}
.tree-content {
    flex: 1;
    overflow-y: auto;
}
.resize-handle {
    position: absolute;
    top: 0;
    right: -3px;
    width: 6px;
    height: 100%;
    cursor: col-resize;
    z-index: 10;
}
.resize-handle:hover {
    background-color: rgba(25, 118, 210, 0.3);
}

/* Center Panel */
.comparison-center-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 400px;
    overflow: hidden;
}
.version-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.version-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: #fff;
    border-bottom: 1px solid #eee;
    flex-shrink: 0;
    gap: 12px;
}
.version-bar-left {
    display: flex;
    align-items: center;
    min-width: 0;
}
.version-bar-right {
    display: flex;
    align-items: center;
    flex-shrink: 0;
}
.version-badge {
    font-size: 12px;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: 12px;
    white-space: nowrap;
}
.badge-new {
    background: #e3f2fd;
    color: #1565c0;
}
.badge-old {
    background: #f3e5f5;
    color: #7b1fa2;
}
.version-select {
    max-width: 140px;
    font-size: 13px;
}
.version-select :deep(.v-field) {
    min-height: 32px !important;
    font-size: 13px;
}
.version-select :deep(.v-field__input) {
    padding-top: 4px;
    padding-bottom: 4px;
}
.version-canvas {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #fafafa;
}
.empty-version {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
}
.empty-process-placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #fafafa;
}

/* Right Panel: Visual Diff */
.comparison-right-panel {
    width: 300px;
    flex-shrink: 0;
    background: #fff;
    border-left: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.diff-header {
    flex-shrink: 0;
}
.diff-legend {
    display: flex;
    gap: 12px;
    font-size: 12px;
}
.legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #666;
}
.legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}
.dot-added { background: #4caf50; }
.dot-modified { background: #ff9800; }
.dot-removed { background: #f44336; }

/* Diff list */
.diff-list {
    flex: 1;
    overflow-y: auto;
}
.diff-item {
    border-bottom: 1px solid #f5f5f5;
}
.diff-item:last-child {
    border-bottom: none;
}
.diff-badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    padding: 1px 8px;
    border-radius: 4px;
    text-transform: lowercase;
}
.diff-badge-added {
    background: #e8f5e9;
    color: #2e7d32;
}
.diff-badge-modified {
    background: #fff3e0;
    color: #e65100;
}
.diff-badge-removed {
    background: #ffebee;
    color: #c62828;
}
.diff-item-content {
    line-height: 1.4;
}
</style>

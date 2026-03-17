<template>
    <v-card elevation="10" class="version-comparison-page rounded-xl">
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
                <v-chip
                    :color="syncScroll ? 'primary' : 'grey'"
                    :variant="syncScroll ? 'flat' : 'outlined'"
                    size="small"
                    class="mr-2"
                    style="cursor: pointer;"
                    @click="syncScroll = !syncScroll"
                >
                    <v-icon start size="14">{{ syncScroll ? 'mdi-link' : 'mdi-link-off' }}</v-icon>
                    {{ $t('versionComparison.syncScroll') || '동기 스크롤' }}
                </v-chip>
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
            <!-- Loading Overlay -->
            <v-overlay
                :model-value="initialLoading"
                contained
                class="align-center justify-center"
                persistent
            >
                <v-progress-circular indeterminate size="48" color="primary" />
            </v-overlay>

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

                <!-- Diff Summary Text -->
                <div v-if="diffSummaryText" class="diff-summary-block pa-3">
                    <v-icon size="14" color="grey-darken-1" class="mr-1">mdi-text-box-outline</v-icon>
                    <span class="diff-summary-text">{{ diffSummaryText }}</span>
                </div>
                <v-divider v-if="diffSummaryText" />

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
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import ProcessHierarchyTree from './ProcessHierarchyTree.vue';
import BpmnUengineViewer from '@/components/BpmnUengineViewer.vue';
import { computeBpmnDiff, formatElementTypeName } from '@/utils/bpmnDiff';

const backend = BackendFactory.createBackend();
const storage = StorageBaseFactory.getStorage();

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

            // Loading state
            initialLoading: false,

            // Diff results
            changes: [],
            diffActivitiesA: {},
            diffActivitiesB: {},
            diffLoading: false,

            // Sync scroll
            syncScroll: true,
            isSyncing: false,

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

        diffSummaryText() {
            if (!this.changes || this.changes.length === 0) return '';

            // 엘리먼트 타입을 한국어 카테고리로 매핑
            const categoryMap = {
                task: '태스크',
                userTask: '태스크',
                serviceTask: '태스크',
                manualTask: '태스크',
                scriptTask: '태스크',
                sendTask: '태스크',
                receiveTask: '태스크',
                businessRuleTask: '태스크',
                startEvent: '이벤트',
                endEvent: '이벤트',
                intermediateThrowEvent: '이벤트',
                intermediateCatchEvent: '이벤트',
                boundaryEvent: '이벤트',
                exclusiveGateway: '게이트웨이',
                parallelGateway: '게이트웨이',
                inclusiveGateway: '게이트웨이',
                eventBasedGateway: '게이트웨이',
                complexGateway: '게이트웨이',
                subProcess: '서브프로세스',
                callActivity: '콜 액티비티',
                sequenceFlow: '시퀀스 플로우',
                participant: '풀',
                lane: '레인',
            };

            // type + category 별로 카운트 집계
            const counts = {};
            this.changes.forEach(change => {
                const category = categoryMap[change.elementType] || change.elementType;
                const key = `${change.type}__${category}`;
                counts[key] = (counts[key] || 0) + 1;
            });

            // 변경 타입별 한국어 접미사
            const typeLabel = {
                added: '추가',
                removed: '삭제',
                modified: '수정',
            };

            // 타입 순서: added -> removed -> modified
            const typeOrder = ['added', 'removed', 'modified'];
            const parts = [];

            typeOrder.forEach(type => {
                // 해당 타입의 카테고리별 카운트를 모아 정리
                const categoryParts = [];
                Object.entries(counts).forEach(([key, count]) => {
                    const [t, cat] = key.split('__');
                    if (t === type) {
                        categoryParts.push(`${cat} ${count}개`);
                    }
                });
                if (categoryParts.length > 0) {
                    parts.push(`${categoryParts.join(', ')} ${typeLabel[type]}`);
                }
            });

            return parts.join(', ');
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
            this.initialLoading = true;
            try {
                const [procMapResult, metricsResult, defList, versionList] = await Promise.all([
                    backend.getProcessDefinitionMap(),
                    backend.getMetricsMap(),
                    backend.listDefinition('', { match: { tenant_id: window.$tenantName } }),
                    storage.list('proc_def_version', {
                        sort: 'desc',
                        orderBy: 'timeStamp',
                        match: { tenant_id: window.$tenantName },
                        key: 'proc_def_id,version',
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
            } finally {
                this.initialLoading = false;
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

                            // [2.6.2] Setup sync scroll
                            this.setupSyncScroll(viewer);
                        } catch (e) {
                            // fallback
                        }
                    }
                }, 150);
            });
        },

        setupSyncScroll(viewer) {
            if (!viewer?.bpmnViewer) return;
            const canvas = viewer.bpmnViewer.get('canvas');
            const isA = viewer === this.$refs.viewerA;

            canvas.on('viewbox.changed', () => {
                if (!this.syncScroll || this.isSyncing) return;

                const otherViewer = isA ? this.$refs.viewerB : this.$refs.viewerA;
                if (!otherViewer?.bpmnViewer) return;

                this.isSyncing = true;
                try {
                    const otherCanvas = otherViewer.bpmnViewer.get('canvas');
                    const sourceVb = canvas.viewbox();
                    otherCanvas.viewbox({
                        x: sourceVb.x,
                        y: sourceVb.y,
                        width: sourceVb.width,
                        height: sourceVb.height,
                    });
                } catch (e) {
                    // ignore
                } finally {
                    this.$nextTick(() => {
                        this.isSyncing = false;
                    });
                }
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
    position: relative;
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

/* Diff Summary */
.diff-summary-block {
    display: flex;
    align-items: flex-start;
    background: #f8f9fa;
    border-bottom: 1px solid #f0f0f0;
    flex-shrink: 0;
}
.diff-summary-text {
    font-size: 12px;
    color: #374151;
    line-height: 1.5;
}

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

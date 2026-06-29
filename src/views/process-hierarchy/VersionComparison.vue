<template>
    <div class="version-comparison-page" :class="{ 'is-dialog-mode': dialogMode }">
        <!-- Header Bar -->
        <div class="comparison-header">
            <div class="header-left">
                <v-btn variant="text" size="small" @click="goBack">
                    <v-icon start>{{ dialogMode ? 'mdi-close' : 'mdi-arrow-left' }}</v-icon>
                    {{ dialogMode ? $t('common.close') || '닫기' : $t('versionComparison.back') || 'Back' }}
                </v-btn>
                <div class="header-divider"></div>
                <v-icon class="mx-2" size="20" color="grey">mdi-swap-horizontal</v-icon>
                <div class="header-title-wrap">
                    <div class="header-title-line">
                        <span class="text-subtitle-1 font-weight-bold">
                            {{ activePr ? activePr.title : ($t('versionComparison.title') || 'Version Comparison') }}
                        </span>
                        <v-chip
                            v-if="activePr"
                            size="x-small"
                            :color="prStatusColor"
                            variant="tonal"
                            class="ml-2"
                        >
                            {{ prStatusLabel }}
                        </v-chip>
                    </div>
                    <div v-if="activePr" class="header-pr-meta">
                        <span class="pr-number">PR #{{ activePr.git_pr_number || '-' }}</span>
                        <span class="meta-dot">&middot;</span>
                        <v-avatar size="18" color="primary" class="mr-1">
                            <span class="text-white" style="font-size: 9px">{{ getInitial(activePr.requester_name) }}</span>
                        </v-avatar>
                        <b>{{ activePr.requester_name || '요청자' }}</b>님이 병합 요청
                        <span class="meta-dot">&middot;</span>
                        <code class="branch-chip">{{ activePr.branch_name }}</code>
                        <v-icon size="10" class="mx-1 text-grey">mdi-arrow-right</v-icon>
                        <code class="branch-chip">{{ activePr.base_branch }}</code>
                        <template v-if="procDefOwnerName">
                            <span class="meta-dot">&middot;</span>
                            <span>담당자</span>
                            <v-avatar size="18" :color="getAvatarColor(procDefOwnerName)" :title="procDefOwnerName" class="ml-1">
                                <span class="text-white" style="font-size: 9px">{{ getInitial(procDefOwnerName) }}</span>
                            </v-avatar>
                        </template>
                    </div>
                </div>
            </div>
            <div class="header-right">
                <v-btn variant="outlined" size="small" :disabled="changes.length === 0" @click="exportDiff">
                    <v-icon start size="14">mdi-download</v-icon>
                    {{ $t('versionComparison.exportDiff') || '비교 내보내기' }}
                </v-btn>
                <v-btn
                    v-if="isOwner"
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
            <template v-if="!dialogMode">
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
                </div>
                <div class="resize-handle" @mousedown="startResize"></div>
            </template>

            <!-- Center Panel: Two BPMN Viewers -->
            <div class="comparison-center-panel" :class="{ 'comparison-center-panel-full': dialogMode }">
                <div v-if="!selectedProcessId" class="empty-process-placeholder">
                    <v-icon size="48" color="grey-lighten-1">mdi-file-compare</v-icon>
                    <div class="text-body-1 text-medium-emphasis mt-3">
                        {{
                            dialogMode
                                ? $t('versionComparison.loadingProcess') || '프로세스 불러오는 중...'
                                : $t('versionComparison.selectProcessToCompare') || '비교할 프로세스를 왼쪽 목록에서 선택하세요'
                        }}
                    </div>
                </div>

                <template v-else>
                    <!-- Version A (New) -->
                    <div class="version-panel">
                        <div class="version-bar">
                            <div class="version-bar-left">
                                <span class="version-badge badge-new">버전 A (신규)</span>
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
                                <span v-if="selectedProcessName" class="text-body-2 ml-3 text-truncate" style="max-width: 200px">
                                    {{ selectedProcessName }}
                                </span>
                            </div>
                            <div class="version-bar-right text-caption text-medium-emphasis">
                                <template v-if="versionAData">
                                    <v-icon size="14" class="mr-1">mdi-calendar</v-icon>
                                    {{ formatDate(versionAData.timeStamp) }}
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
                                <div class="text-caption text-medium-emphasis mt-2">저장된 버전이 없습니다</div>
                            </div>
                        </div>
                    </div>

                    <v-divider />

                    <!-- Version B (Old) -->
                    <div class="version-panel">
                        <div class="version-bar">
                            <div class="version-bar-left">
                                <span class="version-badge badge-old">버전 B (이전)</span>
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
                                <span v-if="selectedProcessName" class="text-body-2 ml-3 text-truncate" style="max-width: 200px">
                                    {{ selectedProcessName }}
                                </span>
                            </div>
                            <div class="version-bar-right text-caption text-medium-emphasis">
                                <template v-if="versionBData">
                                    <v-icon size="14" class="mr-1">mdi-calendar</v-icon>
                                    {{ formatDate(versionBData.timeStamp) }}
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
                                <div class="text-caption text-medium-emphasis mt-2">저장된 버전이 없습니다</div>
                            </div>
                        </div>
                    </div>
                </template>
            </div>

            <!-- Right Panel: 3-Tab -->
            <div class="comparison-right-panel">
                <div class="rail-tabs">
                    <button class="rail-tab" :class="{ 'rail-tab--active': rightTab === 'changes' }" @click="rightTab = 'changes'">
                        <v-icon size="16">mdi-format-list-bulleted</v-icon>
                        변경
                        <span v-if="changes.length > 0" class="rail-tab-count">{{ changes.length }}</span>
                    </button>
                    <button class="rail-tab" :class="{ 'rail-tab--active': rightTab === 'pr' }" @click="rightTab = 'pr'; selectedPrDetail = null">
                        <v-icon size="16">mdi-source-merge</v-icon>
                        병합 요청
                        <span v-if="openPrCount > 0" class="rail-tab-count">{{ openPrCount }}</span>
                    </button>
                    <button class="rail-tab" :class="{ 'rail-tab--active': rightTab === 'history' }" @click="rightTab = 'history'">
                        <v-icon size="16">mdi-clock-outline</v-icon>
                        이력
                    </button>
                </div>

                <!-- ====== 변경 탭 ====== -->
                <div v-show="rightTab === 'changes'" class="rail-pane">
                    <div class="diff-header pa-4 pb-2">
                        <div class="text-subtitle-2 font-weight-bold">시각적 비교</div>
                        <div class="diff-legend mt-2">
                            <span class="legend-item"><span class="legend-dot dot-added"></span>추가됨</span>
                            <span class="legend-item"><span class="legend-dot dot-modified"></span>변경됨</span>
                            <span class="legend-item"><span class="legend-dot dot-removed"></span>삭제됨</span>
                        </div>
                    </div>
                    <div v-if="changes.length > 0" class="diff-section-head">변경 노드 &middot; {{ changes.length }}건</div>
                    <div class="diff-list" v-if="changes.length > 0">
                        <div v-for="(change, i) in changes" :key="i" class="diff-card" @click="focusNode(change.id)">
                            <span class="diff-bar" :class="'diff-bar-' + change.type"></span>
                            <div class="diff-card-content">
                                <div class="diff-card-title">
                                    {{ change.name || change.id }}
                                    <span class="diff-tag" :class="'diff-tag-' + change.type">
                                        {{ change.type === 'added' ? '노드 추가' : change.type === 'modified' ? '속성 변경' : '삭제됨' }}
                                    </span>
                                </div>
                                <div class="diff-card-sub" v-if="change.description">
                                    {{ formatElementType(change.elementType) }} &middot; {{ change.description }}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div v-else-if="versionAXml && versionBXml" class="pa-6 text-center">
                        <v-icon size="32" color="grey-lighten-1">mdi-check-circle-outline</v-icon>
                        <div class="text-caption text-medium-emphasis mt-2">변경 사항이 없습니다</div>
                    </div>
                    <div v-else class="pa-6 text-center">
                        <div class="text-caption text-medium-emphasis">두 버전을 선택하면 비교할 수 있습니다</div>
                    </div>
                    <div v-if="changes.length > 0" class="diff-hint">
                        항목을 누르면 위 다이어그램의 해당 노드로 이동합니다.
                    </div>
                    <div v-if="diffLoading" class="pa-4 text-center">
                        <v-progress-circular indeterminate size="24" width="2" color="primary" />
                        <div class="text-caption text-medium-emphasis mt-2">비교 중...</div>
                    </div>
                </div>

                <!-- ====== 병합 요청 탭 ====== -->
                <div v-show="rightTab === 'pr'" class="rail-pane">
                    <!-- PR 상세 (리뷰/승인) -->
                    <template v-if="selectedPrDetail">
                        <div class="pr-detail-back">
                            <button class="pr-back-btn" @click="selectedPrDetail = null">
                                <v-icon size="14">mdi-arrow-left</v-icon>
                                목록으로
                            </button>
                            <span class="pr-detail-title text-truncate">{{ selectedPrDetail.title }}</span>
                        </div>

                        <!-- 승인 현황 -->
                        <div class="review-approval-section">
                            <div class="review-section-head">승인 현황</div>
                            <div v-if="procDefOwnerName" class="reviewer-row">
                                <v-avatar size="22" :color="getAvatarColor(procDefOwnerName)">
                                    <span class="text-white" style="font-size: 10px">{{ getInitial(procDefOwnerName) }}</span>
                                </v-avatar>
                                <span class="reviewer-name">{{ procDefOwnerName }}</span>
                                <span class="reviewer-role-chip">담당자</span>
                                <span
                                    class="reviewer-status-chip"
                                    :class="latestOwnerAction === 'APPROVED' ? 'st-ok' : latestOwnerAction === 'CHANGES_REQUESTED' ? 'st-req' : 'st-pend'"
                                >
                                    {{ latestOwnerAction === 'APPROVED' ? '승인함' : latestOwnerAction === 'CHANGES_REQUESTED' ? '변경요청' : '검토 중' }}
                                </span>
                            </div>
                        </div>

                        <!-- 코멘트 -->
                        <div class="review-section-head px-4">코멘트 &middot; {{ prReviews.length }}건</div>
                        <PrReviewTimeline :reviews="prReviews" />

                        <!-- 리뷰 입력 -->
                        <PrReviewForm
                            v-if="selectedPrDetail.status === 'OPEN' || selectedPrDetail.status === 'APPROVED' || selectedPrDetail.status === 'CHANGES_REQUESTED'"
                            :is-owner="isOwner && latestOwnerAction === 'PENDING'"
                            :loading="isSubmittingReview"
                            @submit="handleReviewSubmit"
                        >
                            <template #status-bar>
                                <div class="review-submit-row" style="margin-top: 8px;">
                                    <span class="review-gate">
                                        <v-icon size="12" :color="canMerge ? 'success' : 'warning'">
                                            {{ canMerge ? 'mdi-check-circle' : 'mdi-lock' }}
                                        </v-icon>
                                        {{ isApproved ? '담당자 승인 완료' : '담당자 승인 필요' }}
                                        &mdash; {{ canMerge ? '병합 가능' : '병합 잠김' }}
                                    </span>
                                </div>
                            </template>
                        </PrReviewForm>

                        <!-- 병합 버튼 -->
                        <div v-if="isOwner && canMerge && selectedPrDetail.status !== 'MERGED'" class="pr-detail-merge">
                            <v-btn
                                variant="flat"
                                color="deep-purple"
                                size="small"
                                block
                                :loading="isMerging"
                                @click="mergePr()"
                            >
                                <v-icon start size="14">mdi-source-merge</v-icon>
                                병합
                            </v-btn>
                        </div>
                    </template>

                    <!-- PR 목록 -->
                    <template v-else>
                        <div v-if="prHistory.length === 0" class="pa-6 text-center">
                            <v-icon size="32" color="grey-lighten-1">mdi-source-merge</v-icon>
                            <div class="text-caption text-medium-emphasis mt-2">병합 요청이 없습니다</div>
                        </div>
                        <template v-else>
                            <!-- 활성 PR -->
                            <template v-if="activePrList.length > 0">
                                <div class="pr-list-section-head">활성 &middot; {{ activePrList.length }}건</div>
                                <div v-for="pr in activePrList" :key="pr.id" class="prc" @click="openPrDetail(pr)">
                                    <span :class="['pr-accent', prAccentClass(pr.status)]"></span>
                                    <span class="pr-ava" :style="{ background: getAvatarColor(pr.requester_name) }">
                                        {{ getInitial(pr.requester_name) }}
                                    </span>
                                    <div class="prc-body">
                                        <div class="prc-title">
                                            {{ pr.title }}
                                            <span :class="['st-badge', prBadgeClass(pr.status)]">{{ prStatusLabelFn(pr.status) }}</span>
                                        </div>
                                        <div class="prc-byline">
                                            <b>{{ pr.requester_name || '알 수 없음' }}</b>
                                            <span class="dot-sep">&middot;</span>
                                            <span>{{ formatRelativeTime(pr.created_at) }}</span>
                                        </div>
                                        <div class="prc-branchline">
                                            <code class="branch-chip">{{ pr.branch_name }}</code>
                                            <v-icon size="10" class="mx-1 text-grey">mdi-arrow-right</v-icon>
                                            <code class="branch-chip">{{ pr.base_branch }}</code>
                                            <span v-if="pr.git_pr_number" class="pr-num">#{{ pr.git_pr_number }}</span>
                                        </div>
                                    </div>
                                    <div class="prc-actions">
                                        <button v-if="isOwner && pr.status === 'OPEN'" class="pr-review-btn">검토하기</button>
                                        <v-icon v-else size="16" color="grey">mdi-chevron-right</v-icon>
                                    </div>
                                </div>
                            </template>

                            <!-- 병합됨 -->
                            <template v-if="mergedPrList.length > 0">
                                <div class="pr-list-section-head">병합됨 &middot; {{ mergedPrList.length }}건</div>
                                <div v-for="pr in mergedPrList" :key="pr.id" class="prc prc-merged" @click="openPrDetail(pr)">
                                    <span class="pr-accent pr-accent-merged"></span>
                                    <span class="pr-ava pr-ava-merged" :style="{ background: getAvatarColor(pr.requester_name) }">
                                        {{ getInitial(pr.requester_name) }}
                                    </span>
                                    <div class="prc-body">
                                        <div class="prc-title">
                                            {{ pr.title }}
                                            <span class="st-badge st-merged">병합됨</span>
                                        </div>
                                        <div class="prc-byline">
                                            <b>{{ pr.requester_name || '알 수 없음' }}</b>
                                            <span class="dot-sep">&middot;</span>
                                            <span>{{ formatRelativeTime(pr.merged_at || pr.updated_at || pr.created_at) }}</span>
                                        </div>
                                    </div>
                                    <div class="prc-actions">
                                        <v-icon size="16" color="grey">mdi-chevron-right</v-icon>
                                    </div>
                                </div>
                            </template>
                        </template>
                    </template>
                </div>

                <!-- ====== 이력 탭 ====== -->
                <div v-show="rightTab === 'history'" class="rail-pane">
                    <div class="review-section-head px-4 pt-3">버전 이력</div>
                    <div v-for="(ver, idx) in versions" :key="ver.version" class="history-row" :class="{ 'history-row--cur': idx === 0 }">
                        <div class="history-badge">v{{ ver.version }}</div>
                        <div class="history-meta">
                            <div class="history-title">
                                {{ ver.message || `v${ver.version}` }}
                                <span v-if="idx === 0" class="history-cur-tag">현재</span>
                                <span v-if="ver.version_tag === 'major'" class="branch-chip ml-1">major</span>
                            </div>
                            <div class="history-sub">
                                {{ getMergeInfoForVersion(ver) }}{{ formatRelativeTime(ver.timeStamp) }}
                            </div>
                        </div>
                        <div class="history-actions">
                            <button class="history-btn" @click="setVersionAs('A', ver.version)">A로</button>
                            <button class="history-btn" @click="setVersionAs('B', ver.version)">B로</button>
                        </div>
                    </div>
                    <div v-if="versions.length === 0" class="text-center text-caption text-medium-emphasis pa-6">
                        저장된 버전이 없습니다
                    </div>

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
import PrReviewTimeline from '@/components/pr/PrReviewTimeline.vue';
import PrReviewForm from '@/components/pr/PrReviewForm.vue';
import { getInitial as _getInitial, getAvatarColor as _getAvatarColor, formatRelativeTime as _formatRelativeTime, prStatusLabel as _prStatusLabel, prStatusColor as _prStatusColor, prBadgeClass as _prBadgeClass, prAccentClass as _prAccentClass } from '@/composables/usePrUtils';

const backend = BackendFactory.createBackend();
const storage = StorageBaseFactory.getStorage();

const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';

function extractBpmnElements(xml) {
    if (!xml) return [];
    const elements = [];
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');
        const tags = [
            'task','userTask','serviceTask','manualTask','scriptTask',
            'sendTask','receiveTask','businessRuleTask',
            'startEvent','endEvent','intermediateThrowEvent','intermediateCatchEvent','boundaryEvent',
            'exclusiveGateway','parallelGateway','inclusiveGateway','eventBasedGateway','complexGateway',
            'subProcess','callActivity','sequenceFlow','participant','lane'
        ];
        tags.forEach((tag) => {
            const found = doc.getElementsByTagNameNS(BPMN_NS, tag);
            for (let i = 0; i < found.length; i++) {
                const el = found[i];
                const id = el.getAttribute('id');
                if (!id) continue;
                const attrs = {};
                for (let a = 0; a < el.attributes.length; a++) {
                    const attr = el.attributes[a];
                    if (attr.name !== 'id' && !attr.name.startsWith('xmlns')) attrs[attr.name] = attr.value;
                }
                if (tag === 'lane') {
                    const refs = el.getElementsByTagNameNS(BPMN_NS, 'flowNodeRef');
                    const arr = [];
                    for (let r = 0; r < refs.length; r++) { const t = refs[r].textContent?.trim(); if (t) arr.push(t); }
                    if (arr.length > 0) attrs['__flowNodeRefs'] = arr.sort().join(',');
                }
                elements.push({ id, name: el.getAttribute('name') || '', elementType: tag, sourceRef: el.getAttribute('sourceRef') || '', targetRef: el.getAttribute('targetRef') || '', attrs });
            }
        });
    } catch (e) { console.warn('extractBpmnElements failed:', e); }
    return elements;
}

function computeBpmnDiff(oldXml, newXml) {
    const oldEls = extractBpmnElements(oldXml);
    const newEls = extractBpmnElements(newXml);
    const oldMap = new Map(oldEls.map(e => [e.id, e]));
    const newMap = new Map(newEls.map(e => [e.id, e]));
    const changes = [], dA = {}, dB = {};

    for (const [id, el] of newMap) {
        if (!oldMap.has(id)) {
            changes.push({ type:'added', id, name:el.name, elementType:el.elementType, description: descAdd(el) });
            dA[id] = 'added';
        }
    }
    for (const [id, el] of oldMap) {
        if (!newMap.has(id)) {
            changes.push({ type:'removed', id, name:el.name, elementType:el.elementType, description: descRem(el) });
            dB[id] = 'deleted';
        }
    }
    for (const [id, nEl] of newMap) {
        const oEl = oldMap.get(id);
        if (!oEl) continue;
        if (nEl.elementType === 'lane') {
            const oR = new Set((oEl.attrs['__flowNodeRefs']||'').split(',').filter(Boolean));
            const nR = new Set((nEl.attrs['__flowNodeRefs']||'').split(',').filter(Boolean));
            for (const ref of nR) {
                if (!oR.has(ref) && !dA[ref]) {
                    const m = newMap.get(ref);
                    if (m) { dA[ref]='modified'; dB[ref]='modified'; changes.push({ type:'modified',id:ref,name:m.name||ref,elementType:m.elementType,description:`${nEl.name||'다른 레인'}으로 이동` }); }
                }
            }
            const oA={...oEl.attrs}, nA={...nEl.attrs}; delete oA['__flowNodeRefs']; delete nA['__flowNodeRefs'];
            if (JSON.stringify(oA) !== JSON.stringify(nA)) { changes.push({ type:'modified',id,name:nEl.name||oEl.name,elementType:nEl.elementType,description:descMod(oEl,nEl) }); dA[id]='modified'; dB[id]='modified'; }
            continue;
        }
        if (JSON.stringify(oEl.attrs) !== JSON.stringify(nEl.attrs)) {
            changes.push({ type:'modified',id,name:nEl.name||oEl.name,elementType:nEl.elementType,description:descMod(oEl,nEl) });
            dA[id]='modified'; dB[id]='modified';
        }
    }
    return { changes, diffActivitiesA: dA, diffActivitiesB: dB };
}

function descAdd(el) { return `${fmtType(el.elementType)} 추가${el.name?': '+el.name:''}`; }
function descRem(el) { return `${fmtType(el.elementType)} 삭제${el.name?': '+el.name:''}`; }
function descMod(o, n) { return o.name !== n.name ? `이름 변경: "${o.name}" -> "${n.name}"` : `${fmtType(n.elementType)} 속성 변경`; }
function fmtType(t) {
    const m = { task:'Task',userTask:'User Task',serviceTask:'Service Task',manualTask:'Manual Task',scriptTask:'Script Task',sendTask:'Send Task',receiveTask:'Receive Task',businessRuleTask:'Business Rule Task',startEvent:'Start Event',endEvent:'End Event',intermediateThrowEvent:'Intermediate Event',intermediateCatchEvent:'Intermediate Event',boundaryEvent:'Boundary Event',exclusiveGateway:'Gateway',parallelGateway:'Gateway',inclusiveGateway:'Gateway',eventBasedGateway:'Gateway',complexGateway:'Gateway',subProcess:'Sub Process',callActivity:'Call Activity',sequenceFlow:'Sequence Flow',participant:'Participant',lane:'Lane' };
    return m[t] || t;
}

export default {
    name: 'VersionComparison',
    components: { ProcessHierarchyTree, BpmnUengineViewer, PrReviewTimeline, PrReviewForm },
    props: {
        dialogMode: { type: Boolean, default: false },
        initialProcessId: { type: String, default: '' }
    },
    data() {
        return {
            procMap: null, metricsMap: null, definitionList: [],
            selectedProcessId: '', selectedProcessName: '',
            versions: [],
            selectedVersionA: null, selectedVersionB: null,
            versionAData: null, versionBData: null,
            versionAXml: '', versionBXml: '',
            viewerKeyA: 0, viewerKeyB: 0,
            changes: [], diffActivitiesA: {}, diffActivitiesB: {}, diffLoading: false,
            leftPanelWidth: 240, resizing: false, resizeStartX: 0, resizeStartWidth: 0,
            rightTab: 'changes',

            // PR / Review
            activePr: null,
            selectedPrDetail: null,
            prReviews: [],
            prHistory: [],
            currentUserInfo: null,
            procDefOwnerId: '',
            procDefOwnerName: '',
            isSubmittingReview: false,
            isMerging: false
        };
    },
    computed: {
        versionItems() {
            const items = [{ title: '현재 (최신)', value: '__current__' }];
            this.versions.forEach(v => {
                items.push({ title: `v${v.version}${v.version_tag === 'major' ? ' (major)' : ''}`, value: v.version });
            });
            return items;
        },
        isOwner() {
            if (!this.currentUserInfo || !this.procDefOwnerId) return false;
            return this.currentUserInfo.uid === this.procDefOwnerId;
        },
        latestOwnerAction() {
            if (!this.prReviews.length || !this.procDefOwnerId) return 'PENDING';
            for (let i = this.prReviews.length - 1; i >= 0; i--) {
                const r = this.prReviews[i];
                if (r.reviewer_id === this.procDefOwnerId && r.action !== 'COMMENT') return r.action;
            }
            return 'PENDING';
        },
        isApproved() {
            return this.latestOwnerAction === 'APPROVED';
        },
        canMerge() {
            return this.isApproved && this.isOwner;
        },
        prStatusColor() {
            if (!this.activePr) return 'default';
            const s = this.activePr.status;
            if (s === 'OPEN') return this.isApproved ? 'success' : 'primary';
            if (s === 'APPROVED') return 'success';
            if (s === 'CHANGES_REQUESTED') return 'warning';
            if (s === 'MERGED') return 'deep-purple';
            return 'default';
        },
        prStatusLabel() {
            if (!this.activePr) return '';
            const s = this.activePr.status;
            if (s === 'OPEN') return this.isApproved ? '승인됨 · 미병합' : '검토 대기';
            if (s === 'APPROVED') return '승인됨 · 미병합';
            if (s === 'CHANGES_REQUESTED') return '변경 요청됨';
            if (s === 'MERGED') return '병합됨';
            if (s === 'CLOSED') return '닫힘';
            return s;
        },
        openPrCount() {
            return this.prHistory.filter(pr => pr.status !== 'MERGED' && pr.status !== 'CLOSED').length;
        },
        activePrList() {
            return this.prHistory.filter(pr => pr.status !== 'MERGED' && pr.status !== 'CLOSED');
        },
        mergedPrList() {
            return this.prHistory.filter(pr => pr.status === 'MERGED' || pr.status === 'CLOSED');
        }
    },
    async mounted() {
        await this.loadInitialData();
        const processId = this.dialogMode ? (this.initialProcessId || '').trim() : this.$route?.query?.processId || '';
        if (processId) {
            const def = this.definitionList.find(d => d.id === processId || d.file_name === processId);
            const name = def ? def.name || processId : (processId.split('/').pop() || processId).replace(/\.bpmn$/i, '');
            this.handleSelectProcess(processId, name);
        }
        window.addEventListener('mousemove', this.onResize);
        window.addEventListener('mouseup', this.stopResize);
    },
    beforeUnmount() {
        window.removeEventListener('mousemove', this.onResize);
        window.removeEventListener('mouseup', this.stopResize);
    },
    methods: {
        getInitial: _getInitial,
        getAvatarColor: _getAvatarColor,
        formatRelativeTime: _formatRelativeTime,
        prStatusLabelFn: _prStatusLabel,
        prBadgeClass: _prBadgeClass,
        prAccentClass: _prAccentClass,

        async openPrDetail(pr) {
            this.selectedPrDetail = pr;
            this.activePr = pr;
            await this.loadPrReviews(pr.id);
        },

        focusNode(id) {
            const v = this.$refs.viewerA;
            if (v?.bpmnViewer) { try { const er = v.bpmnViewer.get('elementRegistry'); const el = er.get(id); if (el) v.bpmnViewer.get('canvas').scrollToElement(el); } catch(e){} }
        },

        // ---- proc_def owner 로드 ----
        async loadProcDefOwner() {
            if (!this.selectedProcessId) return;
            try {
                const defInfo = await backend.getRawDefinition(this.selectedProcessId);
                const ownerId = defInfo?.owner || '';
                this.procDefOwnerId = ownerId;
                if (ownerId) {
                    try {
                        const ownerUser = await backend.getUserById(ownerId);
                        this.procDefOwnerName = ownerUser?.name || ownerUser?.username || ownerId;
                    } catch (_) {
                        this.procDefOwnerName = ownerId;
                    }
                } else {
                    this.procDefOwnerName = '';
                }
            } catch (e) {
                this.procDefOwnerId = '';
                this.procDefOwnerName = '';
            }
        },

        // ---- PR / Review ----
        async loadPrInfo() {
            if (!this.selectedProcessId) return;
            try {
                const all = await backend.getResourcePrRecords('bpmn', this.selectedProcessId);
                this.prHistory = (all || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                // OPEN 또는 APPROVED(아직 미병합) PR
                const active = all.find(pr => pr.status === 'OPEN' || pr.status === 'APPROVED');
                if (active) {
                    this.activePr = active;
                    await this.loadPrReviews(active.id);
                } else {
                    this.activePr = null;
                    this.prReviews = [];
                }
            } catch (e) {
                this.activePr = null;
                this.prHistory = [];
            }
        },
        async loadPrReviews(prId) {
            try {
                this.prReviews = await backend.getResourcePrReviews(prId);
            } catch (e) {
                this.prReviews = [];
            }
        },
        async loadCurrentUser() {
            try { this.currentUserInfo = await backend.getUserInfo(); } catch (e) { this.currentUserInfo = null; }
        },

        async handleReviewSubmit(action, comment) {
            if (!this.activePr) return;
            if (action !== 'COMMENT' && !this.isOwner) return;

            this.isSubmittingReview = true;
            try {
                const u = this.currentUserInfo || await backend.getUserInfo();
                const name = u?.name || localStorage.getItem('userName') || '';

                await backend.addResourcePrReview(this.activePr.id, action, comment, u.uid, name);

                if (action === 'APPROVED') {
                    await backend.updateResourcePrStatus(this.activePr, 'APPROVED', { reviewerId: u.uid });
                    this.activePr.status = 'APPROVED';
                } else if (action === 'CHANGES_REQUESTED') {
                    await backend.updateResourcePrStatus(this.activePr, 'CHANGES_REQUESTED', { reviewerId: u.uid });
                    this.activePr.status = 'CHANGES_REQUESTED';
                }

                await this.loadPrReviews(this.activePr.id);
            } catch (e) {
                console.error('리뷰 제출 실패:', e);
            } finally {
                this.isSubmittingReview = false;
            }
        },

        async quickReview(action) {
            if (!this.isOwner) return;
            this.rightTab = 'review';
            await this.handleReviewSubmit(action, '');
        },

        async mergePr() {
            if (!this.activePr || !this.canMerge) return;
            this.isMerging = true;
            try {
                const u = this.currentUserInfo || await backend.getUserInfo();

                // 병합 = 메이저 버전 업데이트
                // 현재 최신 버전에서 major 번호를 +1
                const latestVersion = this.versions.length > 0 ? this.versions[0].version : '0.0';
                const majorNum = (parseInt(String(latestVersion).split('.')[0]) || 0) + 1;
                const newMajorVersion = `${majorNum}.0`;

                // 현재 BPMN(최신)을 major 버전으로 저장
                const currentXml = this.versionAXml || this.versionBXml;
                if (currentXml && this.selectedProcessId) {
                    await backend.putRawDefinition(currentXml, this.selectedProcessId, {
                        name: this.selectedProcessName,
                        version: newMajorVersion,
                        version_tag: 'major',
                        arcv_id: `${this.selectedProcessId}_${newMajorVersion}`,
                        message: `[병합] ${this.activePr.title}`
                    });
                }

                // PR 상태를 MERGED로 변경
                await backend.updateResourcePrStatus(this.activePr, 'MERGED', {
                    reviewerId: u.uid,
                    mergedAt: new Date().toISOString()
                });

                this.activePr.status = 'MERGED';
                this.activePr.merged_at = new Date().toISOString();

                // 버전 목록 & PR 이력 새로고침
                await this.reloadVersions();
                await this.loadPrInfo();
                this.$emit('rollbackDone');
            } catch (e) {
                console.error('병합 실패:', e);
            } finally {
                this.isMerging = false;
            }
        },

        async reloadVersions() {
            if (!this.selectedProcessId) return;
            try {
                const vl = await backend.getDefinitionVersions(this.selectedProcessId, { sort: 'desc', orderBy: 'version' });
                if (vl && vl.length > 0) {
                    this.versions = vl.sort((a, b) => {
                        const [aM, am] = String(a.version).split('.').map(Number);
                        const [bM, bm] = String(b.version).split('.').map(Number);
                        return bM !== aM ? bM - aM : (bm||0) - (am||0);
                    });
                }
            } catch (e) { /* ignore */ }
        },

        getMergeInfoForVersion(ver) {
            const pr = this.prHistory.find(p => p.status === 'MERGED' && p.title && p.title.includes(ver.version));
            if (pr) return `PR 병합 · ${pr.requester_name || ''} · `;
            return '';
        },

        setVersionAs(side, version) {
            if (side === 'A') { this.selectedVersionA = version; this.loadVersionA(); }
            else { this.selectedVersionB = version; this.loadVersionB(); }
        },

        // ---- Navigation ----
        goBack() {
            if (this.dialogMode) this.$emit('close');
            else this.$router.back();
        },

        // ---- Data loading ----
        async loadInitialData() {
            try {
                const isUEngine = typeof window !== 'undefined' && window.$mode === 'uEngine';
                const [procMapResult, metricsResult, defList, versionList] = await Promise.all([
                    backend.getProcessDefinitionMap(),
                    backend.getMetricsMap(),
                    backend.listDefinition('', { match: { tenant_id: window.$tenantName } }),
                    storage.list('proc_def_version', { sort: 'desc', orderBy: 'timeStamp' })
                ]);
                this.procMap = procMapResult;
                this.metricsMap = metricsResult;

                let listForVersion = defList || [];
                if (isUEngine && procMapResult?.mega_proc_list?.length > 0) {
                    const flat = [];
                    procMapResult.mega_proc_list.forEach(mega => {
                        (mega.major_proc_list || []).forEach(major => {
                            (major.sub_proc_list || []).forEach(sub => {
                                const sid = sub.id ?? sub.path ?? sub.name;
                                if (sid) flat.push({ id: sid, file_name: sid, name: sub.name ?? sid });
                            });
                        });
                    });
                    if (flat.length > 0) listForVersion = flat;
                }

                const latestVersionMap = {};
                if (isUEngine && listForVersion.length > 0) {
                    const norm = id => typeof id === 'string' ? id.replace(/\.bpmn$/i, '') : id;
                    const vrs = await Promise.all(listForVersion.map(d => {
                        const id = norm(d.id || d.file_name);
                        return id ? backend.getDefinitionVersions(id, { sort:'desc', orderBy:'version' }) : Promise.resolve([]);
                    }));
                    vrs.forEach((versions, idx) => {
                        const rawId = listForVersion[idx]?.id ?? listForVersion[idx]?.file_name;
                        if (!rawId || !versions?.length) return;
                        const sorted = [...versions].sort((a,b) => { const [aM,am]=String(a.version).split('.').map(Number); const [bM,bm]=String(b.version).split('.').map(Number); return bM!==aM?bM-aM:(bm||0)-(am||0); });
                        latestVersionMap[rawId] = String(sorted[0].version);
                    });
                } else if (versionList?.length > 0) {
                    versionList.forEach(v => { if (v.proc_def_id && !latestVersionMap[v.proc_def_id]) latestVersionMap[v.proc_def_id] = v.version; });
                }
                listForVersion.forEach(d => { const id = d.id || d.file_name; if (id && latestVersionMap[id]) d.version = latestVersionMap[id]; });
                this.definitionList = listForVersion;
                await this.loadCurrentUser();
            } catch (e) { console.error('Failed to load initial data:', e); }
        },

        async handleSelectProcess(id, name) {
            if (this.selectedProcessId === id) return;
            this.selectedProcessId = id;
            this.selectedProcessName = name;
            this.versions = []; this.selectedVersionA = null; this.selectedVersionB = null;
            this.versionAData = null; this.versionBData = null; this.versionAXml = ''; this.versionBXml = '';
            this.changes = []; this.diffActivitiesA = {}; this.diffActivitiesB = {};
            this.activePr = null; this.selectedPrDetail = null; this.prReviews = []; this.prHistory = []; this.procDefOwnerId = ''; this.procDefOwnerName = '';

            try {
                const vl = await backend.getDefinitionVersions(id, { sort: 'desc', orderBy: 'version' });
                if (vl && vl.length > 0) {
                    this.versions = vl.sort((a,b) => {
                        const [aM,am]=String(a.version).split('.').map(Number);
                        const [bM,bm]=String(b.version).split('.').map(Number);
                        return bM!==aM?bM-aM:(bm||0)-(am||0);
                    });
                    this.selectedVersionA = '__current__';
                    if (this.versions.length >= 1) this.selectedVersionB = this.versions[0].version;
                    await this.loadVersionA();
                    await this.loadVersionB();
                }
                await Promise.all([this.loadProcDefOwner(), this.loadPrInfo()]);
            } catch (e) { console.error('Failed to load versions:', e); }
        },

        async loadVersionA() {
            if (!this.selectedVersionA || !this.selectedProcessId) return;
            const isUE = typeof window !== 'undefined' && window.$mode === 'uEngine';
            try {
                if (this.selectedVersionA === '__current__') {
                    const def = this.definitionList.find(d => d.id === this.selectedProcessId || d.file_name === this.selectedProcessId);
                    let xml = def?.bpmn || '';
                    if (isUE && !xml) xml = (await backend.getRawDefinition(this.selectedProcessId, { type:'bpmn' })) || '';
                    this.versionAXml = xml;
                    this.versionAData = { version:'current', timeStamp: def?.updated_at || def?.created_at || '', owner: def?.owner || '' };
                } else {
                    const v = this.versions.find(ver => String(ver.version) === String(this.selectedVersionA));
                    if (v) {
                        let xml = v.snapshot || '';
                        if (isUE && !xml) { const s = await backend.getDefinitionVersions(this.selectedProcessId, { key:'snapshot', match:{version:v.version} }); xml = s?.[0]?.snapshot || ''; }
                        this.versionAXml = xml; this.versionAData = v;
                    }
                }
                this.runDiff();
            } catch (e) { console.error('Failed to load version A:', e); }
        },

        async loadVersionB() {
            if (!this.selectedVersionB || !this.selectedProcessId) return;
            const isUE = typeof window !== 'undefined' && window.$mode === 'uEngine';
            try {
                if (this.selectedVersionB === '__current__') {
                    const def = this.definitionList.find(d => d.id === this.selectedProcessId || d.file_name === this.selectedProcessId);
                    let xml = def?.bpmn || '';
                    if (isUE && !xml) xml = (await backend.getRawDefinition(this.selectedProcessId, { type:'bpmn' })) || '';
                    this.versionBXml = xml;
                    this.versionBData = { version:'current', timeStamp: def?.updated_at || def?.created_at || '', owner: def?.owner || '' };
                } else {
                    const v = this.versions.find(ver => String(ver.version) === String(this.selectedVersionB));
                    if (v) {
                        let xml = v.snapshot || '';
                        if (isUE && !xml) { const s = await backend.getDefinitionVersions(this.selectedProcessId, { key:'snapshot', match:{version:v.version} }); xml = s?.[0]?.snapshot || ''; }
                        this.versionBXml = xml; this.versionBData = v;
                    }
                }
                this.runDiff();
            } catch (e) { console.error('Failed to load version B:', e); }
        },

        runDiff() {
            if (!this.versionAXml || !this.versionBXml) { this.changes=[]; this.diffActivitiesA={}; this.diffActivitiesB={}; return; }
            this.diffLoading = true;
            setTimeout(() => {
                try {
                    const r = computeBpmnDiff(this.versionBXml, this.versionAXml);
                    this.changes = r.changes; this.diffActivitiesA = r.diffActivitiesA; this.diffActivitiesB = r.diffActivitiesB;
                    this.viewerKeyA++; this.viewerKeyB++;
                } catch (e) { console.error('Diff computation failed:', e); this.changes = []; }
                finally { this.diffLoading = false; }
            }, 100);
        },

        onViewerRendered(viewer) {
            this.$nextTick(() => { setTimeout(() => { if (viewer?.bpmnViewer) { try { viewer.bpmnViewer.get('canvas').zoom('fit-viewport','auto'); } catch(e){} } }, 150); });
        },
        formatElementType(type) { return fmtType(type); },
        formatDate(ts) {
            if (!ts) return '';
            try { return new Date(ts).toLocaleString('ko-KR', { year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit' }); }
            catch { return ts; }
        },
        exportDiff() {
            if (!this.changes.length) return;
            const l = [`Version Comparison: ${this.selectedProcessName}`,`Version A: ${this.selectedVersionA==='__current__'?'Current':'v'+this.selectedVersionA}`,`Version B: ${this.selectedVersionB==='__current__'?'Current':'v'+this.selectedVersionB}`,'','Changes:'];
            this.changes.forEach(c => { l.push(`  [${c.type.toUpperCase()}] ${fmtType(c.elementType)}: ${c.name||c.id}`); if (c.description) l.push(`    ${c.description}`); });
            const b = new Blob([l.join('\n')], { type:'text/plain' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href=u; a.download=`version-diff-${this.selectedProcessId}.txt`; a.click(); URL.revokeObjectURL(u);
        },
        async applyChanges() {
            if (!this.versionBXml || !this.selectedProcessId) return;
            const vl = this.selectedVersionB==='__current__' ? 'Current' : 'v'+this.selectedVersionB;
            if (!confirm(`${vl} 버전으로 되돌리시겠습니까?`)) return;
            try {
                await backend.putRawDefinition(this.versionBXml, this.selectedProcessId, { name: this.selectedProcessName });
                this.$emit('rollbackDone');
            } catch (e) { console.error('Rollback failed:', e); }
        },
        startResize(e) { this.resizing=true; this.resizeStartX=e.clientX; this.resizeStartWidth=this.leftPanelWidth; e.preventDefault(); },
        onResize(e) { if (!this.resizing) return; this.leftPanelWidth = Math.max(180, Math.min(400, this.resizeStartWidth + (e.clientX - this.resizeStartX))); },
        stopResize() { this.resizing = false; }
    }
};
</script>

<style scoped>
.version-comparison-page { display:flex; flex-direction:column; height:calc(100vh - 125px); background:#F4F6F9; overflow:hidden; }
.version-comparison-page.is-dialog-mode { height:100vh; }

.comparison-header { display:flex; align-items:center; justify-content:space-between; padding:10px 20px; background:#fff; border-bottom:1px solid #E6E8EE; flex-shrink:0; gap:14px; }
.header-left { display:flex; align-items:center; min-width:0; flex:1; }
.header-divider { width:1px; height:22px; background:#D9DCE3; margin:0 8px; }
.header-title-wrap { display:flex; flex-direction:column; gap:2px; min-width:0; }
.header-title-line { display:flex; align-items:center; gap:8px; }
.header-pr-meta { display:flex; align-items:center; gap:6px; font-size:11.5px; color:#697084; flex-wrap:wrap; }
.header-pr-meta b { color:#1E2330; font-weight:600; }
.pr-number { font-weight:600; color:#9AA0AD; }
.meta-dot { color:#9AA0AD; }
.branch-chip { font-family:ui-monospace,Menlo,monospace; font-size:11px; background:#EEF0F4; border-radius:6px; padding:1px 7px; color:#697084; }
.header-right { display:flex; align-items:center; gap:8px; flex-shrink:0; }

.comparison-body { display:flex; flex:1; overflow:hidden; }
.comparison-left-panel { flex-shrink:0; background:#fff; border-right:1px solid #E6E8EE; display:flex; flex-direction:column; position:relative; overflow:hidden; }
.tree-header { flex-shrink:0; }
.tree-content { flex:1; overflow-y:auto; }
.resize-handle { position:absolute; top:0; right:-3px; width:6px; height:100%; cursor:col-resize; z-index:10; }
.resize-handle:hover { background-color:rgba(25,118,210,0.3); }

.comparison-center-panel { flex:1; display:flex; flex-direction:column; min-width:400px; overflow:hidden; border-right:1px solid #E6E8EE; }
.comparison-center-panel-full { min-width:0; }
.version-panel { flex:1; display:flex; flex-direction:column; overflow:hidden; }
.version-bar { display:flex; align-items:center; justify-content:space-between; padding:8px 16px; background:#fff; border-bottom:1px solid #eee; flex-shrink:0; gap:12px; }
.version-bar-left { display:flex; align-items:center; min-width:0; }
.version-bar-right { display:flex; align-items:center; flex-shrink:0; }
.version-badge { font-size:12px; font-weight:700; padding:3px 11px; border-radius:8px; white-space:nowrap; }
.badge-new { background:#EAF1FF; color:#1B4FCB; }
.badge-old { background:#F0EBFB; color:#5e45b8; }
.version-select { max-width:180px; font-size:13px; }
.version-select :deep(.v-field) { min-height:32px !important; font-size:13px; }
.version-select :deep(.v-field__input) { padding-top:4px; padding-bottom:4px; }
.version-canvas { flex:1; position:relative; overflow:hidden; background:#fff; }
.empty-version { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; }
.empty-process-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#fafafa; }

.comparison-right-panel { width:360px; flex-shrink:0; background:#FBFCFD; display:flex; flex-direction:column; overflow:hidden; }

.rail-tabs { display:flex; padding:8px 14px 0; gap:4px; border-bottom:1px solid #E6E8EE; background:#fff; }
.rail-tab { flex:1; border:none; background:none; padding:9px 6px; font-size:12.5px; font-weight:600; color:#697084; border-bottom:2px solid transparent; display:flex; align-items:center; justify-content:center; gap:6px; cursor:pointer; transition:.15s; }
.rail-tab:hover { color:#1E2330; }
.rail-tab--active { color:#1B4FCB; border-bottom-color:#2F6BFF; }
.rail-tab-count { background:#EAF1FF; color:#1B4FCB; font-size:10.5px; font-weight:700; border-radius:8px; padding:0 6px; min-width:17px; height:17px; display:inline-flex; align-items:center; justify-content:center; }
.rail-pane { flex:1; overflow-y:auto; display:flex; flex-direction:column; }

.diff-header { flex-shrink:0; }
.diff-legend { display:flex; gap:14px; font-size:12px; }
.legend-item { display:flex; align-items:center; gap:6px; color:#697084; }
.legend-dot { width:10px; height:10px; border-radius:50%; }
.dot-added { background:#22A05B; }
.dot-modified { background:#E0922B; }
.dot-removed { background:#E04848; }
.diff-section-head { font-size:11px; font-weight:700; color:#9AA0AD; text-transform:uppercase; letter-spacing:.04em; padding:8px 16px 4px; }
.diff-list { flex:1; overflow-y:auto; }
.diff-card { display:flex; gap:10px; padding:11px 14px; margin:0 10px 7px; border:1px solid #E6E8EE; border-radius:11px; background:#fff; cursor:pointer; transition:.12s; }
.diff-card:hover { border-color:#BBCBE8; box-shadow:0 2px 8px rgba(30,50,100,.06); }
.diff-bar { width:4px; border-radius:3px; flex:none; }
.diff-bar-added { background:#22A05B; }
.diff-bar-modified { background:#E0922B; }
.diff-bar-removed { background:#E04848; }
.diff-card-content { flex:1; min-width:0; }
.diff-card-title { font-size:13px; font-weight:600; display:flex; align-items:center; gap:7px; }
.diff-card-sub { font-size:11.5px; color:#697084; margin-top:2px; }
.diff-tag { font-size:9.5px; font-weight:700; border-radius:5px; padding:1px 6px; color:#fff; white-space:nowrap; }
.diff-tag-added { background:#22A05B; }
.diff-tag-modified { background:#E0922B; }
.diff-tag-removed { background:#E04848; }
.diff-hint { margin:10px 14px; padding:10px 12px; border:1px solid #E6E8EE; border-radius:10px; background:#fff; font-size:11.5px; color:#697084; }

.review-approval-section { padding:14px 16px; border-bottom:1px solid #E6E8EE; }
.review-section-head { font-size:11px; font-weight:700; color:#9AA0AD; text-transform:uppercase; letter-spacing:.04em; margin-bottom:9px; }
.reviewer-row { display:flex; align-items:center; gap:9px; padding:6px 0; }
.reviewer-name { font-size:13px; font-weight:600; }
.reviewer-role-chip { font-size:10px; font-weight:700; color:#1B4FCB; background:#EAF1FF; border-radius:5px; padding:1px 6px; }
.reviewer-status-chip { margin-left:auto; font-size:11px; font-weight:600; border-radius:6px; padding:2px 8px; }
.st-ok { background:#E4F6EC; color:#137a40; }
.st-pend { background:#EEF0F4; color:#697084; }
.st-req { background:#FCF1DD; color:#9a630f; }

.review-comments-list { flex:1; overflow-y:auto; min-height:60px; }
.review-comment { display:flex; gap:9px; padding:11px 16px; border-bottom:1px solid #F0F2F5; }
.review-comment-body { flex:1; min-width:0; }
.review-comment-header { display:flex; align-items:center; gap:7px; font-size:12px; }
.review-comment-header b { font-weight:600; }
.review-comment-time { color:#9AA0AD; font-size:11px; }
.review-comment-text { font-size:12.5px; margin-top:5px; }

.review-add-section { padding:12px 16px; border-top:1px solid #E6E8EE; background:#fff; margin-top:auto; }
.review-textarea { width:100%; border:1px solid #D9DCE3; border-radius:10px; padding:9px 11px; font-size:12.5px; font-family:inherit; resize:vertical; min-height:46px; outline:none; }
.review-textarea:focus { border-color:#2F6BFF; }
.review-actions-bar { margin-top:10px; }
.review-decide { display:flex; gap:7px; margin-bottom:10px; }
.review-opt { flex:1; display:flex; align-items:center; justify-content:center; gap:6px; border:1px solid #D9DCE3; border-radius:9px; padding:7px 6px; font-size:12px; cursor:pointer; font-weight:600; color:#697084; transition:.12s; }
.review-radio { width:13px; height:13px; border-radius:50%; border:2px solid currentColor; flex:none; }
.review-opt--sel.review-opt--comment { border-color:#697084; background:#F1F2F5; color:#1E2330; }
.review-opt--sel.review-opt--approve { border-color:#22A05B; background:#E4F6EC; color:#137a40; }
.review-opt--sel.review-opt--changes { border-color:#E0922B; background:#FCF1DD; color:#9a630f; }
.review-submit-row { display:flex; align-items:center; gap:8px; }
.review-gate { font-size:11.5px; color:#697084; display:flex; align-items:center; gap:6px; }

.history-row { display:flex; gap:11px; padding:12px 14px; margin:8px 12px 0; border:1px solid #E6E8EE; border-radius:11px; align-items:center; background:#fff; }
.history-row--cur { border-color:#BBCBE8; background:#F7FAFF; }
.history-badge { width:38px; height:38px; border-radius:9px; background:#EAF1FF; color:#1B4FCB; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:11.5px; flex:none; }
.pr-status-badge { flex:none; }
.history-meta { flex:1; min-width:0; }
.history-title { font-size:13px; font-weight:600; display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
.history-sub { font-size:11px; color:#697084; margin-top:2px; }
.history-cur-tag { font-size:10px; font-weight:700; color:#137a40; background:#E4F6EC; border-radius:5px; padding:1px 6px; }
.history-actions { display:flex; gap:5px; flex:none; }
.history-btn { border:1px solid #D9DCE3; background:#fff; border-radius:7px; padding:5px 9px; font-size:11px; color:#697084; font-weight:600; cursor:pointer; transition:.12s; }
.history-btn:hover { background:#F4F6F9; }

/* ── PR 목록 (병합 요청 탭) ── */
.pr-detail-back { display:flex; align-items:center; gap:8px; padding:10px 14px; border-bottom:1px solid #E6E8EE; background:#fff; flex-shrink:0; }
.pr-back-btn { border:none; background:none; display:flex; align-items:center; gap:4px; font-size:12px; font-weight:600; color:#697084; cursor:pointer; padding:4px 8px; border-radius:6px; transition:.12s; }
.pr-back-btn:hover { background:#F4F6F9; color:#1E2330; }
.pr-detail-title { font-size:13px; font-weight:600; color:#1E2330; min-width:0; }
.pr-list-section-head { font-size:11px; font-weight:700; color:#9AA0AD; text-transform:uppercase; letter-spacing:.04em; padding:12px 14px 6px; }
.prc { display:flex; gap:10px; align-items:flex-start; padding:12px 12px; margin:0 10px 7px; border:1px solid #E6E8EE; border-radius:11px; background:#fff; position:relative; cursor:pointer; transition:border-color .12s, box-shadow .12s; }
.prc:hover { border-color:#BBCBE8; box-shadow:0 2px 8px rgba(30,50,100,.06); }
.prc-merged { opacity:.85; }
.prc-merged:hover { opacity:1; }
.pr-accent { position:absolute; left:0; top:12px; bottom:12px; width:3px; border-radius:3px; }
.ac-open { background:#1B4FCB; }
.ac-chg { background:#E0922B; }
.ac-app { background:#22A05B; }
.ac-merged { background:#7C6BD6; }
.pr-accent-merged { background:#7C6BD6; }
.pr-ava { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:#fff; flex:none; margin-top:1px; }
.pr-ava-merged { opacity:.7; }
.prc-body { flex:1; min-width:0; padding-left:2px; }
.prc-title { font-size:13px; font-weight:600; display:flex; gap:7px; align-items:center; flex-wrap:wrap; line-height:1.4; }
.prc-byline { display:flex; align-items:center; gap:6px; margin-top:5px; font-size:11.5px; color:#697084; flex-wrap:wrap; }
.prc-byline b { color:#1E2330; font-weight:600; }
.prc-branchline { display:flex; align-items:center; gap:4px; margin-top:5px; flex-wrap:wrap; }
.dot-sep { color:#9AA0AD; }
.pr-num { color:#9AA0AD; font-size:11px; margin-left:4px; }
.prc-actions { display:flex; align-items:center; flex:none; padding-top:2px; }
.pr-review-btn { border:none; background:#1B4FCB; color:#fff; border-radius:7px; padding:5px 12px; font-size:11.5px; font-weight:600; cursor:pointer; transition:opacity .12s; }
.pr-review-btn:hover { opacity:.85; }
.st-badge { font-size:10px; font-weight:600; border-radius:5px; padding:1px 7px; white-space:nowrap; }
.st-open { background:#EAF1FF; color:#1B4FCB; }
.st-chg { background:#FCF1DD; color:#9a630f; }
.st-app { background:#E4F6EC; color:#137a40; }
.st-merged { background:#F0EBFB; color:#5e45b8; }
.pr-detail-merge { padding:12px 16px; border-top:1px solid #E6E8EE; margin-top:auto; }
</style>

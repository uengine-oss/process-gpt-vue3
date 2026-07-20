<template>
    <v-dialog v-model="dialogVisible" fullscreen persistent transition="dialog-bottom-transition">
        <div v-if="dialogVisible" class="dvc-page">
            <!-- Header -->
            <div class="dvc-header">
                <div class="dvc-header-left">
                    <v-btn variant="text" size="small" @click="close">
                        <v-icon start>mdi-close</v-icon>
                        닫기
                    </v-btn>
                    <div class="dvc-header-divider"></div>
                    <v-icon class="mx-2" size="20" color="grey">mdi-swap-horizontal</v-icon>
                    <span class="text-subtitle-1 font-weight-bold">{{ dmnName }}</span>
                </div>
                <div class="dvc-header-right">
                    <v-btn
                        v-if="isOwner && canMerge && selectedPr && selectedPr.status !== 'MERGED'"
                        variant="flat"
                        size="small"
                        color="deep-purple"
                        :loading="merging"
                        @click="mergePr"
                    >
                        <v-icon start size="14">mdi-source-merge</v-icon> 병합
                    </v-btn>
                </div>
            </div>

            <div class="dvc-body">
                <!-- Center: Two DMN Viewers -->
                <div class="dvc-center">
                    <!-- Version A (신규) -->
                    <div class="dvc-vpanel">
                        <div class="dvc-vbar">
                            <div class="dvc-vbar-left">
                                <span class="dvc-badge dvc-badge-new">버전 A (신규)</span>
                                <v-select
                                    v-model="selectedA"
                                    :items="versionItems"
                                    item-title="title"
                                    item-value="value"
                                    density="compact"
                                    variant="outlined"
                                    hide-details
                                    class="dvc-vselect ml-3"
                                    :disabled="versions.length === 0"
                                    @update:model-value="loadVersionA"
                                />
                            </div>
                            <div class="dvc-vbar-right text-caption text-medium-emphasis">
                                <template v-if="versionAData">
                                    <v-icon size="14" class="mr-1">mdi-calendar</v-icon>
                                    {{ formatTime(versionAData.timeStamp) }}
                                </template>
                            </div>
                        </div>
                        <div class="dvc-canvas">
                            <DmnModeler v-if="versionAXml" :key="'ha-' + viewerKeyA" :dmn="versionAXml" :isViewMode="true" />
                            <div v-else class="dvc-empty">
                                <v-icon size="32" color="grey-lighten-1">mdi-file-document-outline</v-icon>
                                <div class="text-caption text-medium-emphasis mt-2">저장된 버전이 없습니다</div>
                            </div>
                        </div>
                    </div>

                    <v-divider />

                    <!-- Version B (이전) -->
                    <div class="dvc-vpanel">
                        <div class="dvc-vbar">
                            <div class="dvc-vbar-left">
                                <span class="dvc-badge dvc-badge-old">버전 B (이전)</span>
                                <v-select
                                    v-model="selectedB"
                                    :items="versionItems"
                                    item-title="title"
                                    item-value="value"
                                    density="compact"
                                    variant="outlined"
                                    hide-details
                                    class="dvc-vselect ml-3"
                                    :disabled="versions.length === 0"
                                    @update:model-value="loadVersionB"
                                />
                            </div>
                            <div class="dvc-vbar-right text-caption text-medium-emphasis">
                                <template v-if="versionBData">
                                    <v-icon size="14" class="mr-1">mdi-calendar</v-icon>
                                    {{ formatTime(versionBData.timeStamp) }}
                                </template>
                            </div>
                        </div>
                        <div class="dvc-canvas">
                            <DmnModeler v-if="versionBXml" :key="'hb-' + viewerKeyB" :dmn="versionBXml" :isViewMode="true" />
                            <div v-else class="dvc-empty">
                                <v-icon size="32" color="grey-lighten-1">mdi-file-document-outline</v-icon>
                                <div class="text-caption text-medium-emphasis mt-2">저장된 버전이 없습니다</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right Panel: 3-Tab -->
                <div class="dvc-right">
                    <div class="dmn-history-tabs">
                        <button :class="['dmn-history-tab', { 'dmn-history-tab--active': tab === 'changes' }]" @click="tab = 'changes'">
                            <v-icon size="16">mdi-format-list-bulleted</v-icon>
                            변경
                            <span v-if="diffChanges.length > 0" class="dmn-history-tab-count">{{ diffChanges.length }}</span>
                        </button>
                        <button
                            :class="['dmn-history-tab', { 'dmn-history-tab--active': tab === 'pr' }]"
                            @click="
                                tab = 'pr';
                                selectedPr = null;
                            "
                        >
                            <v-icon size="16">mdi-source-merge</v-icon>
                            병합 요청
                            <span v-if="openPrCount > 0" class="dmn-history-tab-count">{{ openPrCount }}</span>
                        </button>
                        <button :class="['dmn-history-tab', { 'dmn-history-tab--active': tab === 'history' }]" @click="tab = 'history'">
                            <v-icon size="16">mdi-clock-outline</v-icon>
                            이력
                        </button>
                    </div>

                    <div class="dvc-rail-pane">
                        <!-- 변경 탭 -->
                        <div v-show="tab === 'changes'">
                            <div class="pa-4 pb-2">
                                <div class="text-subtitle-2 font-weight-bold">DMN 비교</div>
                                <div class="dvc-legend mt-2">
                                    <span class="dvc-legend-item"><span class="dvc-legend-dot dvc-dot-added"></span>추가됨</span>
                                    <span class="dvc-legend-item"><span class="dvc-legend-dot dvc-dot-modified"></span>변경됨</span>
                                    <span class="dvc-legend-item"><span class="dvc-legend-dot dvc-dot-removed"></span>삭제됨</span>
                                </div>
                            </div>
                            <div v-if="diffChanges.length > 0" class="dmn-pr-section-head px-4">변경 항목 · {{ diffChanges.length }}건</div>
                            <div v-if="diffChanges.length > 0" class="dvc-diff-list">
                                <div
                                    v-for="(c, i) in diffChanges"
                                    :key="i"
                                    :class="[
                                        'dvc-diff-card',
                                        { 'dvc-diff-card--expandable': c.hasDetail, 'dvc-diff-card--open': expandedDiffIndex === i }
                                    ]"
                                    @click="c.hasDetail && toggleDiffDetail(i)"
                                >
                                    <span :class="['dvc-diff-bar', 'dvc-diff-bar-' + c.type]"></span>
                                    <div class="dvc-diff-content">
                                        <div class="dvc-diff-title">
                                            {{ c.name || c.id }}
                                            <span :class="['dvc-diff-tag', 'dvc-diff-tag-' + c.type]">
                                                {{ c.type === 'added' ? '추가' : c.type === 'modified' ? '변경' : '삭제' }}
                                            </span>
                                            <v-icon v-if="c.hasDetail" size="14" class="ml-auto" color="grey">
                                                {{ expandedDiffIndex === i ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
                                            </v-icon>
                                        </div>
                                        <div v-if="c.description" class="dvc-diff-sub">{{ c.description }}</div>

                                        <!-- Expanded detail -->
                                        <div v-if="expandedDiffIndex === i && c.hasDetail" class="dvc-diff-detail" @click.stop>
                                            <!-- InputData diff -->
                                            <template v-if="c.category === 'input'">
                                                <KeyValueDiffTable
                                                    v-if="c.raw.diffs && c.raw.diffs.length > 0"
                                                    :diffs="getInputDiffs(c.raw)"
                                                    :labels="{ name: '이름', typeRef: '타입' }"
                                                />
                                                <div v-else class="text-caption text-medium-emphasis pa-2">
                                                    타입: {{ getInputType(c.raw.current || c.raw.previous) }}
                                                </div>
                                            </template>
                                            <!-- Decision diff -->
                                            <template v-if="c.category === 'decision'">
                                                <div v-if="c.metaDesc" class="dvc-diff-meta mb-2">{{ c.metaDesc }}</div>
                                                <DecisionTableDiff
                                                    v-if="c.raw.current?.decisionTable || c.raw.previous?.decisionTable"
                                                    :previous="c.type === 'added' ? null : c.raw.previous?.decisionTable || null"
                                                    :current="c.type === 'removed' ? null : c.raw.current?.decisionTable || null"
                                                />
                                            </template>
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
                        </div>

                        <!-- 병합 요청 탭 -->
                        <div v-show="tab === 'pr'">
                            <template v-if="selectedPr">
                                <div class="dmn-pr-detail-back">
                                    <button class="dmn-pr-back-btn" @click="selectedPr = null">
                                        <v-icon size="14">mdi-arrow-left</v-icon> 목록으로
                                    </button>
                                    <span class="dmn-pr-detail-title text-truncate">{{ selectedPr.title }}</span>
                                </div>
                                <div class="dmn-pr-approval-section">
                                    <div class="dmn-pr-section-head">승인 현황</div>
                                    <div v-if="ownerName" class="dmn-pr-reviewer-row">
                                        <v-avatar size="22" :color="getAvatarColor(ownerName)">
                                            <span class="text-white" style="font-size: 10px">{{ getInitial(ownerName) }}</span>
                                        </v-avatar>
                                        <span class="dmn-pr-reviewer-name">{{ ownerName }}</span>
                                        <span class="dmn-pr-role-chip">담당자</span>
                                        <span
                                            :class="[
                                                'dmn-pr-status-chip',
                                                latestOwnerAction === 'APPROVED'
                                                    ? 'st-ok'
                                                    : latestOwnerAction === 'CHANGES_REQUESTED'
                                                    ? 'st-req'
                                                    : 'st-pend'
                                            ]"
                                        >
                                            {{
                                                latestOwnerAction === 'APPROVED'
                                                    ? '승인함'
                                                    : latestOwnerAction === 'CHANGES_REQUESTED'
                                                    ? '변경요청'
                                                    : '검토 중'
                                            }}
                                        </span>
                                    </div>
                                </div>
                                <div class="dmn-pr-section-head px-4">코멘트 · {{ prReviews.length }}건</div>
                                <PrReviewTimeline :reviews="prReviews" />
                                <PrReviewForm
                                    v-if="
                                        selectedPr.status === 'OPEN' ||
                                        selectedPr.status === 'APPROVED' ||
                                        selectedPr.status === 'CHANGES_REQUESTED'
                                    "
                                    :is-owner="isOwner && latestOwnerAction === 'PENDING'"
                                    :loading="reviewSubmitting"
                                    @submit="handleReviewSubmit"
                                />
                            </template>
                            <template v-else>
                                <div v-if="prList.length === 0" class="pa-6 text-center">
                                    <v-icon size="32" color="grey-lighten-1">mdi-source-merge</v-icon>
                                    <div class="text-caption text-medium-emphasis mt-2">병합 요청이 없습니다</div>
                                </div>
                                <template v-else>
                                    <template v-if="activePrList.length > 0">
                                        <div class="dmn-pr-list-head">활성 · {{ activePrList.length }}건</div>
                                        <div v-for="pr in activePrList" :key="pr.id" class="dmn-prc" @click="openPrDetail(pr)">
                                            <span :class="['dmn-pr-accent', prAccentClass(pr.status)]"></span>
                                            <span class="dmn-pr-ava" :style="{ background: getAvatarColor(pr.requester_name) }">{{
                                                getInitial(pr.requester_name)
                                            }}</span>
                                            <div class="dmn-prc-body">
                                                <div class="dmn-prc-title">
                                                    {{ pr.title }}
                                                    <span :class="['dmn-st-badge', prBadgeClass(pr.status)]">{{
                                                        prStatusLabelFn(pr.status)
                                                    }}</span>
                                                </div>
                                                <div class="dmn-prc-byline">
                                                    <b>{{ pr.requester_name || '알 수 없음' }}</b
                                                    ><span class="dmn-dot-sep">·</span><span>{{ formatRelativeTime(pr.created_at) }}</span>
                                                </div>
                                                <div class="dmn-prc-branchline">
                                                    <code class="dmn-branch-chip">{{ pr.branch_name }}</code
                                                    ><v-icon size="10" class="mx-1 text-grey">mdi-arrow-right</v-icon
                                                    ><code class="dmn-branch-chip">{{ pr.base_branch }}</code>
                                                </div>
                                            </div>
                                            <v-icon size="16" color="grey">mdi-chevron-right</v-icon>
                                        </div>
                                    </template>
                                    <template v-if="mergedPrList.length > 0">
                                        <div class="dmn-pr-list-head">병합됨 · {{ mergedPrList.length }}건</div>
                                        <div
                                            v-for="pr in mergedPrList"
                                            :key="pr.id"
                                            class="dmn-prc dmn-prc-merged"
                                            @click="openPrDetail(pr)"
                                        >
                                            <span class="dmn-pr-accent ac-merged"></span>
                                            <span
                                                class="dmn-pr-ava"
                                                :style="{ background: getAvatarColor(pr.requester_name), opacity: 0.7 }"
                                                >{{ getInitial(pr.requester_name) }}</span
                                            >
                                            <div class="dmn-prc-body">
                                                <div class="dmn-prc-title">
                                                    {{ pr.title }} <span class="dmn-st-badge st-merged">병합됨</span>
                                                </div>
                                                <div class="dmn-prc-byline">
                                                    <b>{{ pr.requester_name || '알 수 없음' }}</b
                                                    ><span class="dmn-dot-sep">·</span
                                                    ><span>{{ formatRelativeTime(pr.merged_at || pr.updated_at || pr.created_at) }}</span>
                                                </div>
                                            </div>
                                            <v-icon size="16" color="grey">mdi-chevron-right</v-icon>
                                        </div>
                                    </template>
                                </template>
                            </template>
                        </div>

                        <!-- 이력 탭 -->
                        <div v-show="tab === 'history'">
                            <div
                                v-for="(ver, idx) in versions"
                                :key="ver.version"
                                class="dmn-history-row"
                                :class="{ 'dmn-history-row--cur': idx === 0 }"
                            >
                                <div class="dmn-history-badge">v{{ ver.version }}</div>
                                <div class="dmn-history-meta">
                                    <div class="dmn-history-title">
                                        {{ ver.message || `v${ver.version}` }}
                                        <span v-if="idx === 0" class="dmn-history-cur-tag">현재</span>
                                        <span v-if="ver.version_tag === 'major'" class="dmn-history-major-chip">major</span>
                                    </div>
                                    <div class="dmn-history-sub">{{ formatTime(ver.timeStamp) }}</div>
                                </div>
                                <div class="dvc-history-actions">
                                    <button class="dvc-history-btn" @click="setVersionAs('A', ver.version)">A로</button>
                                    <button class="dvc-history-btn" @click="setVersionAs('B', ver.version)">B로</button>
                                </div>
                            </div>
                            <div v-if="versions.length === 0" class="text-center text-caption text-medium-emphasis pa-6">
                                저장된 버전이 없습니다
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </v-dialog>
</template>

<script>
import DmnModeler from '../DmnModeler.vue';
import KeyValueDiffTable from '@/components/dmn/KeyValueDiffTable.vue';
import DecisionTableDiff from '@/components/dmn/DecisionTableDiff.vue';
import PrReviewTimeline from '@/components/pr/PrReviewTimeline.vue';
import PrReviewForm from '@/components/pr/PrReviewForm.vue';
import { parseDmnXml, diffDmn } from '@/utils/dmnParser';
import {
    getInitial as _getInitial,
    getAvatarColor as _getAvatarColor,
    formatRelativeTime as _formatRelativeTime,
    prStatusLabel as _prStatusLabel,
    prBadgeClass as _prBadgeClass,
    prAccentClass as _prAccentClass
} from '@/composables/usePrUtils';

export default {
    name: 'DmnVersionHistoryDialog',
    components: {
        DmnModeler,
        KeyValueDiffTable,
        DecisionTableDiff,
        PrReviewTimeline,
        PrReviewForm
    },
    props: {
        modelValue: { type: Boolean, default: false },
        dmnName: { type: String, default: '' },
        dmnId: { type: String, default: '' },
        backend: { type: Object, required: true },
        userInfo: { type: Object, default: null }
    },
    emits: ['update:modelValue', 'merged'],
    data() {
        return {
            tab: 'changes',
            versions: [],
            prList: [],
            selectedPr: null,
            prReviews: [],
            ownerId: '',
            ownerName: '',
            currentUserInfo: null,
            reviewSubmitting: false,
            merging: false,

            selectedA: null,
            selectedB: null,
            versionAData: null,
            versionBData: null,
            versionAXml: '',
            versionBXml: '',
            viewerKeyA: 0,
            viewerKeyB: 0,
            expandedDiffIndex: null
        };
    },
    computed: {
        dialogVisible: {
            get() {
                return this.modelValue;
            },
            set(val) {
                this.$emit('update:modelValue', val);
            }
        },
        versionItems() {
            const items = [{ title: '현재 (최신)', value: '__current__' }];
            this.versions.forEach((v) => {
                items.push({ title: `v${v.version}${v.version_tag === 'major' ? ' (major)' : ''}`, value: v.version });
            });
            return items;
        },
        openPrCount() {
            return this.prList.filter((pr) => pr.status !== 'MERGED' && pr.status !== 'CLOSED').length;
        },
        activePrList() {
            return this.prList.filter((pr) => pr.status !== 'MERGED' && pr.status !== 'CLOSED');
        },
        mergedPrList() {
            return this.prList.filter((pr) => pr.status === 'MERGED' || pr.status === 'CLOSED');
        },
        isOwner() {
            if (!this.currentUserInfo || !this.ownerId) return false;
            return this.currentUserInfo.uid === this.ownerId;
        },
        latestOwnerAction() {
            if (!this.prReviews.length || !this.ownerId) return 'PENDING';
            for (let i = this.prReviews.length - 1; i >= 0; i--) {
                const r = this.prReviews[i];
                if (r.reviewer_id === this.ownerId && r.action !== 'COMMENT') return r.action;
            }
            return 'PENDING';
        },
        canMerge() {
            return this.latestOwnerAction === 'APPROVED' && this.isOwner;
        },
        parsedA() {
            return this.versionAXml ? parseDmnXml(this.versionAXml) : null;
        },
        parsedB() {
            return this.versionBXml ? parseDmnXml(this.versionBXml) : null;
        },
        diffChanges() {
            if (!this.parsedA || !this.parsedB) return [];
            const diff = diffDmn(this.parsedB, this.parsedA);
            const items = [];
            const typeLabel = (t) => (t === 'added' ? '추가' : t === 'modified' ? '변경' : '삭제');

            (diff.inputChanges || []).forEach((ch) => {
                const obj = ch.current || ch.previous || {};
                items.push({
                    type: ch.type,
                    id: ch.key,
                    name: obj.name || ch.key,
                    description: `InputData ${typeLabel(ch.type)}`,
                    category: 'input',
                    hasDetail: true,
                    raw: ch
                });
            });

            (diff.decisionChanges || []).forEach((ch) => {
                const obj = ch.current || ch.previous || {};
                const parts = [];
                if (ch.tableDiff) {
                    const s = ch.tableDiff.summary;
                    if (s.addedRules) parts.push(`규칙 ${s.addedRules}개 추가`);
                    if (s.modifiedRules) parts.push(`규칙 ${s.modifiedRules}개 변경`);
                    if (s.removedRules) parts.push(`규칙 ${s.removedRules}개 삭제`);
                }
                if (parts.length === 0) parts.push(`Decision ${typeLabel(ch.type)}`);

                let metaDesc = '';
                const prev = ch.previous;
                const curr = ch.current;
                if (ch.type === 'modified' && prev?.name && curr?.name && prev.name !== curr.name) {
                    metaDesc = `이름: ${prev.name} → ${curr.name}`;
                }

                items.push({
                    type: ch.type,
                    id: ch.key,
                    name: obj.name || ch.key,
                    description: parts.join(', '),
                    category: 'decision',
                    hasDetail: true,
                    raw: ch,
                    metaDesc
                });
            });

            return items;
        }
    },
    watch: {
        modelValue(val) {
            if (val) this.loadHistory();
        }
    },
    methods: {
        getInitial: _getInitial,
        getAvatarColor: _getAvatarColor,
        prStatusLabelFn: _prStatusLabel,
        prBadgeClass: _prBadgeClass,
        prAccentClass: _prAccentClass,
        formatRelativeTime: _formatRelativeTime,

        close() {
            this.dialogVisible = false;
        },

        formatTime(ts) {
            if (!ts) return '';
            try {
                return new Date(ts).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch {
                return ts;
            }
        },

        sortVersions(versionInfo) {
            return versionInfo.sort((a, b) => {
                const [aM, am] = String(a.version).split('.').map(Number);
                const [bM, bm] = String(b.version).split('.').map(Number);
                return bM !== aM ? bM - aM : (bm || 0) - (am || 0);
            });
        },

        async loadHistory() {
            this.tab = 'changes';
            this.versions = [];
            this.prList = [];
            this.selectedPr = null;
            this.prReviews = [];
            this.ownerId = '';
            this.ownerName = '';
            this.currentUserInfo = null;
            this.selectedA = null;
            this.selectedB = null;
            this.versionAData = null;
            this.versionBData = null;
            this.versionAXml = '';
            this.versionBXml = '';
            this.expandedDiffIndex = null;

            const defId = this.dmnId;
            if (!defId) return;

            try {
                const [versionInfo, defInfo, userInfo] = await Promise.all([
                    this.backend.getDefinitionVersions(defId, { sort: 'desc', orderBy: 'timeStamp' }),
                    this.backend.getRawDefinition(defId),
                    this.backend.getUserInfo()
                ]);

                this.currentUserInfo = userInfo;

                if (versionInfo && versionInfo.length > 0) {
                    this.versions = this.sortVersions(versionInfo);
                    this.selectedA = '__current__';
                    if (this.versions.length >= 1) {
                        this.selectedB = this.versions[0].version;
                    }
                    await this.loadVersionA();
                    await this.loadVersionB();
                }

                const ownerId = defInfo?.owner || '';
                this.ownerId = ownerId;
                if (ownerId) {
                    try {
                        const ownerUser = await this.backend.getUserById(ownerId);
                        this.ownerName = ownerUser?.name || ownerUser?.username || ownerId;
                    } catch (_) {
                        this.ownerName = ownerId;
                    }
                }

                try {
                    const allPrs = await this.backend.getResourcePrRecords('dmn', defId);
                    this.prList = (allPrs || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                } catch (_) {
                    this.prList = [];
                }
            } catch (e) {
                console.error('버전 이력 로드 실패:', e);
            }
        },

        async loadVersionA() {
            if (!this.selectedA) return;
            try {
                if (this.selectedA === '__current__') {
                    const def = await this.backend.getRawDefinition(this.dmnId);
                    this.versionAXml = def?.bpmn || '';
                    this.versionAData = { version: 'current', timeStamp: def?.updated_at || '' };
                } else {
                    const v = this.versions.find((ver) => String(ver.version) === String(this.selectedA));
                    if (v) {
                        this.versionAXml = v.snapshot || '';
                        this.versionAData = v;
                    }
                }
                this.viewerKeyA++;
                this.expandedDiffIndex = null;
            } catch (e) {
                console.error('버전 A 로드 실패:', e);
            }
        },

        async loadVersionB() {
            if (!this.selectedB) return;
            try {
                if (this.selectedB === '__current__') {
                    const def = await this.backend.getRawDefinition(this.dmnId);
                    this.versionBXml = def?.bpmn || '';
                    this.versionBData = { version: 'current', timeStamp: def?.updated_at || '' };
                } else {
                    const v = this.versions.find((ver) => String(ver.version) === String(this.selectedB));
                    if (v) {
                        this.versionBXml = v.snapshot || '';
                        this.versionBData = v;
                    }
                }
                this.viewerKeyB++;
                this.expandedDiffIndex = null;
            } catch (e) {
                console.error('버전 B 로드 실패:', e);
            }
        },

        toggleDiffDetail(index) {
            this.expandedDiffIndex = this.expandedDiffIndex === index ? null : index;
        },

        getInputDiffs(ch) {
            const prev = ch.previous || null;
            const curr = ch.current || null;
            if (ch.type === 'modified') {
                const diffs = [];
                if ((prev?.name || '') !== (curr?.name || ''))
                    diffs.push({ field: 'name', previous: prev?.name || null, current: curr?.name || null });
                if ((prev?.variable?.typeRef || '') !== (curr?.variable?.typeRef || ''))
                    diffs.push({ field: 'typeRef', previous: prev?.variable?.typeRef || null, current: curr?.variable?.typeRef || null });
                return diffs;
            }
            if (ch.type === 'added') {
                return [
                    { field: 'name', previous: null, current: curr?.name || null },
                    { field: 'typeRef', previous: null, current: curr?.variable?.typeRef || null }
                ];
            }
            if (ch.type === 'removed') {
                return [
                    { field: 'name', previous: prev?.name || null, current: null },
                    { field: 'typeRef', previous: prev?.variable?.typeRef || null, current: null }
                ];
            }
            return [];
        },

        getInputType(inputData) {
            return inputData?.variable?.typeRef || '-';
        },

        setVersionAs(side, version) {
            if (side === 'A') {
                this.selectedA = version;
                this.loadVersionA();
            } else {
                this.selectedB = version;
                this.loadVersionB();
            }
        },

        async openPrDetail(pr) {
            this.selectedPr = pr;
            try {
                this.prReviews = await this.backend.getResourcePrReviews(pr.id);
            } catch (_) {
                this.prReviews = [];
            }
        },

        async handleReviewSubmit(action, comment) {
            if (!this.selectedPr) return;
            if (action !== 'COMMENT' && !this.isOwner) return;

            this.reviewSubmitting = true;
            try {
                const u = this.currentUserInfo || (await this.backend.getUserInfo());
                const name = u?.name || localStorage.getItem('userName') || '';

                await this.backend.addResourcePrReview(this.selectedPr.id, action, comment, u.uid, name);

                if (action === 'APPROVED') {
                    await this.backend.updateResourcePrStatus(this.selectedPr, 'APPROVED', { reviewerId: u.uid });
                    this.selectedPr.status = 'APPROVED';
                } else if (action === 'CHANGES_REQUESTED') {
                    await this.backend.updateResourcePrStatus(this.selectedPr, 'CHANGES_REQUESTED', { reviewerId: u.uid });
                    this.selectedPr.status = 'CHANGES_REQUESTED';
                }

                this.prReviews = await this.backend.getResourcePrReviews(this.selectedPr.id);
            } catch (e) {
                console.error('리뷰 제출 실패:', e);
            } finally {
                this.reviewSubmitting = false;
            }
        },

        async mergePr() {
            if (!this.selectedPr || !this.canMerge) return;
            this.merging = true;
            try {
                const u = this.currentUserInfo || (await this.backend.getUserInfo());
                const defId = this.dmnId;

                const latestVersion = this.versions.length > 0 ? this.versions[0].version : '0.0';
                const majorNum = (parseInt(String(latestVersion).split('.')[0]) || 0) + 1;
                const newMajorVersion = `${majorNum}.0`;

                const currentDef = await this.backend.getRawDefinition(defId);
                if (currentDef?.bpmn && defId) {
                    await this.backend.putRawDefinition(currentDef.bpmn, defId, {
                        type: 'dmn',
                        name: this.dmnName,
                        version: newMajorVersion,
                        version_tag: 'major',
                        arcv_id: `${defId}_${newMajorVersion}`,
                        message: `[병합] ${this.selectedPr.title}`
                    });
                }

                await this.backend.updateResourcePrStatus(this.selectedPr, 'MERGED', {
                    reviewerId: u.uid,
                    mergedAt: new Date().toISOString()
                });

                this.selectedPr.status = 'MERGED';

                const versionInfo = await this.backend.getDefinitionVersions(defId, { sort: 'desc', orderBy: 'timeStamp' });
                if (versionInfo && versionInfo.length > 0) {
                    this.versions = this.sortVersions(versionInfo);
                }
                const allPrs = await this.backend.getResourcePrRecords('dmn', defId);
                this.prList = (allPrs || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                this.$emit('merged');
            } catch (e) {
                console.error('병합 실패:', e);
            } finally {
                this.merging = false;
            }
        }
    }
};
</script>

<style scoped>
/* ── 버전 비교 전체화면 ── */
.dvc-page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #f4f6f9;
    overflow: hidden;
}

.dvc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;
    background: #fff;
    border-bottom: 1px solid #e6e8ee;
    flex-shrink: 0;
    gap: 14px;
}
.dvc-header-left {
    display: flex;
    align-items: center;
    min-width: 0;
    flex: 1;
}
.dvc-header-divider {
    width: 1px;
    height: 22px;
    background: #d9dce3;
    margin: 0 8px;
}
.dvc-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
}

.dvc-body {
    display: flex;
    flex: 1;
    overflow: hidden;
}

.dvc-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 400px;
    overflow: hidden;
    border-right: 1px solid #e6e8ee;
}
.dvc-vpanel {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.dvc-vbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: #fff;
    border-bottom: 1px solid #eee;
    flex-shrink: 0;
    gap: 12px;
}
.dvc-vbar-left {
    display: flex;
    align-items: center;
    min-width: 0;
}
.dvc-vbar-right {
    display: flex;
    align-items: center;
    flex-shrink: 0;
}
.dvc-badge {
    font-size: 12px;
    font-weight: 700;
    padding: 3px 11px;
    border-radius: 8px;
    white-space: nowrap;
}
.dvc-badge-new {
    background: #eaf1ff;
    color: #1b4fcb;
}
.dvc-badge-old {
    background: #f0ebfb;
    color: #5e45b8;
}
.dvc-vselect {
    max-width: 180px;
    font-size: 13px;
}
.dvc-vselect :deep(.v-field) {
    min-height: 32px !important;
    font-size: 13px;
}
.dvc-vselect :deep(.v-field__input) {
    padding-top: 4px;
    padding-bottom: 4px;
}
.dvc-canvas {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #fff;
}
.dvc-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
}

.dvc-right {
    width: 360px;
    flex-shrink: 0;
    background: #fbfcfd;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.dvc-rail-pane {
    flex: 1;
    overflow-y: auto;
}

/* diff card list */
.dvc-legend {
    display: flex;
    gap: 14px;
    font-size: 12px;
}
.dvc-legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #697084;
}
.dvc-legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
}
.dvc-dot-added {
    background: #22a05b;
}
.dvc-dot-modified {
    background: #e0922b;
}
.dvc-dot-removed {
    background: #e04848;
}
.dvc-diff-list {
    flex: 1;
    overflow-y: auto;
}
.dvc-diff-card {
    display: flex;
    gap: 10px;
    padding: 11px 14px;
    margin: 0 10px 7px;
    border: 1px solid #e6e8ee;
    border-radius: 11px;
    background: #fff;
}
.dvc-diff-bar {
    width: 4px;
    border-radius: 3px;
    flex: none;
}
.dvc-diff-bar-added {
    background: #22a05b;
}
.dvc-diff-bar-modified {
    background: #e0922b;
}
.dvc-diff-bar-removed {
    background: #e04848;
}
.dvc-diff-content {
    flex: 1;
    min-width: 0;
}
.dvc-diff-title {
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 7px;
}
.dvc-diff-sub {
    font-size: 11.5px;
    color: #697084;
    margin-top: 2px;
}
.dvc-diff-tag {
    font-size: 9.5px;
    font-weight: 700;
    border-radius: 5px;
    padding: 1px 6px;
    color: #fff;
    white-space: nowrap;
}
.dvc-diff-tag-added {
    background: #22a05b;
}
.dvc-diff-tag-modified {
    background: #e0922b;
}
.dvc-diff-tag-removed {
    background: #e04848;
}
.dvc-diff-card--expandable {
    cursor: pointer;
    transition: border-color 0.12s, box-shadow 0.12s;
}
.dvc-diff-card--expandable:hover {
    border-color: #bbcbe8;
    box-shadow: 0 2px 8px rgba(30, 50, 100, 0.06);
}
.dvc-diff-card--open {
    border-color: #bbcbe8;
    background: #fafbff;
}
.dvc-diff-detail {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid #e6e8ee;
}
.dvc-diff-meta {
    font-size: 12px;
    color: #697084;
    background: #f4f6f9;
    border-radius: 6px;
    padding: 6px 10px;
}

/* history actions */
.dvc-history-actions {
    display: flex;
    gap: 5px;
    flex: none;
}
.dvc-history-btn {
    border: 1px solid #d9dce3;
    background: #fff;
    border-radius: 7px;
    padding: 5px 9px;
    font-size: 11px;
    color: #697084;
    font-weight: 600;
    cursor: pointer;
    transition: 0.12s;
}
.dvc-history-btn:hover {
    background: #f4f6f9;
}

/* tabs */
.dmn-history-tabs {
    display: flex;
    padding: 8px 14px 0;
    gap: 4px;
    border-bottom: 1px solid #e6e8ee;
    background: #fff;
    flex-shrink: 0;
}
.dmn-history-tab {
    flex: 1;
    border: none;
    background: none;
    padding: 9px 6px;
    font-size: 12.5px;
    font-weight: 600;
    color: #697084;
    border-bottom: 2px solid transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    transition: 0.15s;
}
.dmn-history-tab:hover {
    color: #1e2330;
}
.dmn-history-tab--active {
    color: #1b4fcb;
    border-bottom-color: #2f6bff;
}
.dmn-history-tab-count {
    background: #eaf1ff;
    color: #1b4fcb;
    font-size: 10.5px;
    font-weight: 700;
    border-radius: 8px;
    padding: 0 6px;
    min-width: 17px;
    height: 17px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

/* 이력 행 */
.dmn-history-row {
    display: flex;
    gap: 11px;
    padding: 12px 14px;
    margin: 8px 12px 0;
    border: 1px solid #e6e8ee;
    border-radius: 11px;
    align-items: center;
    background: #fff;
}
.dmn-history-row--cur {
    border-color: #bbcbe8;
    background: #f7faff;
}
.dmn-history-badge {
    width: 38px;
    height: 38px;
    border-radius: 9px;
    background: #eaf1ff;
    color: #1b4fcb;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 11.5px;
    flex: none;
}
.dmn-history-meta {
    flex: 1;
    min-width: 0;
}
.dmn-history-title {
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
}
.dmn-history-sub {
    font-size: 11px;
    color: #697084;
    margin-top: 2px;
}
.dmn-history-cur-tag {
    font-size: 10px;
    font-weight: 700;
    color: #137a40;
    background: #e4f6ec;
    border-radius: 5px;
    padding: 1px 6px;
}
.dmn-history-major-chip {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11px;
    background: #eef0f4;
    border-radius: 6px;
    padding: 1px 7px;
    color: #697084;
}

/* PR 목록 */
.dmn-pr-list-head {
    font-size: 11px;
    font-weight: 700;
    color: #9aa0ad;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 12px 14px 6px;
}
.dmn-prc {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px;
    margin: 0 10px 7px;
    border: 1px solid #e6e8ee;
    border-radius: 11px;
    background: #fff;
    position: relative;
    cursor: pointer;
    transition: border-color 0.12s, box-shadow 0.12s;
}
.dmn-prc:hover {
    border-color: #bbcbe8;
    box-shadow: 0 2px 8px rgba(30, 50, 100, 0.06);
}
.dmn-prc-merged {
    opacity: 0.85;
}
.dmn-prc-merged:hover {
    opacity: 1;
}
.dmn-pr-accent {
    position: absolute;
    left: 0;
    top: 12px;
    bottom: 12px;
    width: 3px;
    border-radius: 3px;
}
.ac-open {
    background: #1b4fcb;
}
.ac-chg {
    background: #e0922b;
}
.ac-app {
    background: #22a05b;
}
.ac-merged {
    background: #7c6bd6;
}
.dmn-pr-ava {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: #fff;
    flex: none;
    margin-top: 1px;
}
.dmn-prc-body {
    flex: 1;
    min-width: 0;
    padding-left: 2px;
}
.dmn-prc-title {
    font-size: 13px;
    font-weight: 600;
    display: flex;
    gap: 7px;
    align-items: center;
    flex-wrap: wrap;
    line-height: 1.4;
}
.dmn-prc-byline {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 5px;
    font-size: 11.5px;
    color: #697084;
    flex-wrap: wrap;
}
.dmn-prc-byline b {
    color: #1e2330;
    font-weight: 600;
}
.dmn-prc-branchline {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 5px;
    flex-wrap: wrap;
}
.dmn-dot-sep {
    color: #9aa0ad;
}
.dmn-branch-chip {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11px;
    background: #eef0f4;
    border-radius: 6px;
    padding: 1px 7px;
    color: #697084;
}
.dmn-st-badge {
    font-size: 10px;
    font-weight: 600;
    border-radius: 5px;
    padding: 1px 7px;
    white-space: nowrap;
}
.st-open {
    background: #eaf1ff;
    color: #1b4fcb;
}
.st-chg {
    background: #fcf1dd;
    color: #9a630f;
}
.st-app {
    background: #e4f6ec;
    color: #137a40;
}
.st-merged {
    background: #f0ebfb;
    color: #5e45b8;
}

/* PR 상세 */
.dmn-pr-detail-back {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid #e6e8ee;
    background: #fff;
    flex-shrink: 0;
}
.dmn-pr-back-btn {
    border: none;
    background: none;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: #697084;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: 0.12s;
}
.dmn-pr-back-btn:hover {
    background: #f4f6f9;
    color: #1e2330;
}
.dmn-pr-detail-title {
    font-size: 13px;
    font-weight: 600;
    color: #1e2330;
    min-width: 0;
}
.dmn-pr-approval-section {
    padding: 14px 16px;
    border-bottom: 1px solid #e6e8ee;
}
.dmn-pr-section-head {
    font-size: 11px;
    font-weight: 700;
    color: #9aa0ad;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 9px;
}
.dmn-pr-reviewer-row {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 6px 0;
}
.dmn-pr-reviewer-name {
    font-size: 13px;
    font-weight: 600;
}
.dmn-pr-role-chip {
    font-size: 10px;
    font-weight: 700;
    color: #1b4fcb;
    background: #eaf1ff;
    border-radius: 5px;
    padding: 1px 6px;
}
.dmn-pr-status-chip {
    margin-left: auto;
    font-size: 11px;
    font-weight: 600;
    border-radius: 6px;
    padding: 2px 8px;
}
.st-ok {
    background: #e4f6ec;
    color: #137a40;
}
.st-pend {
    background: #eef0f4;
    color: #697084;
}
.st-req {
    background: #fcf1dd;
    color: #9a630f;
}
</style>

<template>
    <div class="dmn-diff-view">
        <!-- 단일 컬럼 리포트: expand 시 한번에 전체 변경을 스크롤로 확인 -->
        <div class="dmn-report">
            <!-- InputData -->
            <div v-if="dmnDiff.inputChanges.length > 0" :id="'dmn-section-input'" class="mb-4">
                <div class="d-flex align-center justify-space-between mb-2">
                    <div class="text-body-2 font-weight-medium">입력 데이터 (InputData)</div>
                </div>
                <div class="dmn-report-list">
                    <v-card v-for="ch in dmnDiff.inputChanges" :key="'in-card-' + ch.key" elevation="0" class="dmn-report-card">
                        <div class="d-flex align-center ga-2 mb-2">
                            <v-chip :color="getChangeColor(ch.type)" size="x-small" variant="flat">{{ getChangeText(ch.type) }}</v-chip>
                            <div class="text-body-2 font-weight-medium text-truncate">{{ getInputTitle(ch) }}</div>
                        </div>
                        <!-- 추가/삭제: 해당 내용만 / 수정: 전후 비교 -->
                        <div v-if="ch.type === 'added'" class="dmn-info-row">
                            <div class="text-body-2"><span class="text-medium-emphasis">타입</span> {{ getInputType(ch.current) }}</div>
                        </div>
                        <div v-else-if="ch.type === 'removed'" class="dmn-info-row dmn-removed-soft">
                            <div class="text-body-2"><span class="text-medium-emphasis">타입</span> {{ getInputType(ch.previous) }}</div>
                        </div>
                        <div v-else>
                            <key-value-diff-table :diffs="getInputDiffs(ch)" :labels="{ name: '이름', typeRef: '타입' }" />
                        </div>
                    </v-card>
                </div>
            </div>

            <!-- Decision -->
            <div v-if="dmnDiff.decisionChanges.length > 0" :id="'dmn-section-decision'" class="mb-4">
                <div class="d-flex align-center justify-space-between mb-2">
                    <div class="text-body-2 font-weight-medium">결정 (Decision)</div>
                </div>
                <div class="dmn-report-list">
                    <v-card v-for="ch in dmnDiff.decisionChanges" :key="'dec-card-' + ch.key" elevation="0" class="dmn-report-card">
                        <div class="d-flex align-center ga-2 mb-2">
                            <v-chip :color="getChangeColor(ch.type)" size="x-small" variant="flat">{{ getChangeText(ch.type) }}</v-chip>
                            <div class="text-body-2 font-weight-medium text-truncate">{{ getDecisionTitle(ch) }}</div>
                            <v-chip v-if="(ch.current?.decisionTable || ch.previous?.decisionTable)" color="info" size="x-small" variant="tonal">DecisionTable</v-chip>
                            <v-chip v-else-if="(ch.current?.literalExpression || ch.previous?.literalExpression)" color="info" size="x-small" variant="tonal">Expression</v-chip>
                        </div>

                        <!-- (금지사항 준수) 요구관계/표현식은 raw 데이터 노출 금지: 요약만 표시 -->
                        <div
                            v-if="decisionNameChangeText(ch) || reqSummaryText(ch) || expressionSummaryText(ch)"
                            class="dmn-meta-block mb-2"
                        >
                            <div v-if="decisionNameChangeText(ch)" class="text-body-2">
                                <span class="text-medium-emphasis">이름</span> {{ decisionNameChangeText(ch) }}
                            </div>
                            <div v-if="reqSummaryText(ch)" class="text-body-2 mt-1">
                                <span class="text-medium-emphasis">요구 관계</span> {{ reqSummaryText(ch) }}
                            </div>
                            <div v-if="expressionSummaryText(ch)" class="text-body-2 mt-1">
                                <span class="text-medium-emphasis">표현식</span> {{ expressionSummaryText(ch) }}
                            </div>
                        </div>

                        <!-- DecisionTable: 수정은 전/후 비교, 추가/삭제는 한쪽만 -->
                        <decision-table-diff
                            v-if="(ch.current?.decisionTable || ch.previous?.decisionTable)"
                            :previous="ch.type === 'added' ? null : (ch.previous?.decisionTable || null)"
                            :current="ch.type === 'removed' ? null : (ch.current?.decisionTable || null)"
                        />
                    </v-card>
                </div>
            </div>

        </div>

        <!-- 변경 요약 (기존처럼 하단 1회만 표시) -->
        <div class="mt-2">
            <div class="d-flex align-center justify-space-between">
                <div class="flex-grow-1">
                    <div class="text-body-2 font-weight-medium mb-1">변경 요약</div>
                    <div class="summary-chips">
                        <v-chip
                            v-for="c in elementSummaryChips"
                            :key="c.key"
                            :color="c.color"
                            size="small"
                            variant="tonal"
                        >
                            {{ c.text }}
                        </v-chip>
                        <span v-if="elementSummaryChips.length === 0" class="text-caption text-medium-emphasis">-</span>
                    </div>
                </div>
                <div class="ml-4">
                    <slot name="actions"></slot>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { diffDmn } from '@/utils/dmnParser';
import KeyValueDiffTable from '@/components/dmn/KeyValueDiffTable.vue';
import DecisionTableDiff from '@/components/dmn/DecisionTableDiff.vue';

export default {
    name: 'DmnDiffView',
    components: {
        KeyValueDiffTable,
        DecisionTableDiff
    },
    props: {
        previous: {
            type: Object,
            required: true
        },
        current: {
            type: Object,
            required: true
        }
    },
    computed: {
        dmnDiff() {
            return diffDmn(this.previous, this.current);
        },
        elementSummaryChips() {
            const countByType = (list) => ({
                added: (list || []).filter((c) => c.type === 'added').length,
                modified: (list || []).filter((c) => c.type === 'modified').length,
                removed: (list || []).filter((c) => c.type === 'removed').length
            });

            const inputCounts = countByType(this.dmnDiff.inputChanges || []);
            const decisionCounts = countByType(this.dmnDiff.decisionChanges || []);

            // DecisionTable Rule 변경 개수 (Decision별 tableDiff에서 집계)
            const ruleCounts = { added: 0, modified: 0, removed: 0 };
            (this.dmnDiff.decisionChanges || []).forEach((ch) => {
                const td = ch?.tableDiff;
                if (!td || !td.summary) return;
                ruleCounts.added += td.summary.addedRules || 0;
                ruleCounts.modified += td.summary.modifiedRules || 0;
                ruleCounts.removed += td.summary.removedRules || 0;
            });

            const defChanged = (this.dmnDiff.definitionsDiffs || []).length > 0;
            const definitionCounts = { added: 0, modified: defChanged ? 1 : 0, removed: 0 };

            const items = [
                { key: 'definitions', label: 'Definitions', counts: definitionCounts },
                { key: 'inputData', label: 'InputData', counts: inputCounts },
                { key: 'decision', label: 'Decision', counts: decisionCounts },
                { key: 'rule', label: 'Rule', counts: ruleCounts }
            ];

            const chips = [];
            const push = (k, type, n) => {
                if (!n || n <= 0) return;
                const color = type === 'added' ? 'success' : type === 'modified' ? 'warning' : 'error';
                const sign = type === 'added' ? '+' : type === 'modified' ? '~' : '-';
                chips.push({
                    key: `${k}:${type}`,
                    color,
                    text: `${k} ${sign}${n}`
                });
            };

            items.forEach((it) => {
                push(it.label, 'added', it.counts.added);
                push(it.label, 'modified', it.counts.modified);
                push(it.label, 'removed', it.counts.removed);
            });

            return chips;
        }
    },
    methods: {
        getChangeColor(type) {
            if (type === 'added') return 'success';
            if (type === 'removed') return 'error';
            if (type === 'modified') return 'warning';
            return 'default';
        },
        getChangeText(type) {
            if (type === 'added') return '추가';
            if (type === 'removed') return '삭제';
            if (type === 'modified') return '수정';
            return type;
        },
        getInputTitle(ch) {
            const obj = ch.current || ch.previous || {};
            return `${obj.name || '-'} (${obj.id || ch.key})`;
        },
        getDecisionTitle(ch) {
            const obj = ch.current || ch.previous || {};
            return `${obj.name || '-'} (${obj.id || ch.key})`;
        },
        buildDiffsForAddedRemoved(type, obj, fields) {
            const res = [];
            (fields || []).forEach((f) => {
                if (type === 'added') res.push({ field: f, previous: null, current: obj?.[f] });
                else if (type === 'removed') res.push({ field: f, previous: obj?.[f], current: null });
            });
            return res;
        },
        getInputDiffs(ch) {
            // variable/요구관계 같은 raw object 노출 금지 → 해석 가능한 필드만
            const prev = ch.previous || null;
            const curr = ch.current || null;
            if (ch.type === 'modified') {
                const diffs = [];
                if ((prev?.name || '') !== (curr?.name || '')) diffs.push({ field: 'name', previous: prev?.name || null, current: curr?.name || null });
                if ((prev?.variable?.typeRef || '') !== (curr?.variable?.typeRef || '')) diffs.push({ field: 'typeRef', previous: prev?.variable?.typeRef || null, current: curr?.variable?.typeRef || null });
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
            if (!inputData) return '-';
            return inputData.variable?.typeRef || '-';
        },
        decisionNameChangeText(ch) {
            if (!ch) return '';
            if (ch.type === 'modified') {
                const prev = ch.previous?.name || '';
                const curr = ch.current?.name || '';
                if (prev && curr && prev !== curr) return `${prev} → ${curr}`;
                return '';
            }
            return '';
        },
        buildIdNameMapFromDmn(dmn) {
            const map = {};
            (dmn?.inputData || []).forEach((i) => { if (i?.id) map[i.id] = i.name || i.id; });
            (dmn?.decisions || []).forEach((d) => { if (d?.id) map[d.id] = d.name || d.id; });
            return map;
        },
        hrefToId(href) {
            if (!href) return '';
            const s = String(href);
            if (s.startsWith('#')) return s.slice(1);
            return s;
        },
        extractReqIds(decision) {
            const reqs = decision?.informationRequirements || [];
            const inputs = [];
            const decisions = [];
            reqs.forEach((r) => {
                const inId = this.hrefToId(r.requiredInputHref);
                const decId = this.hrefToId(r.requiredDecisionHref);
                if (inId) inputs.push(inId);
                if (decId) decisions.push(decId);
            });
            return { inputs, decisions };
        },
        reqSummaryText(ch) {
            // raw 구조 JSON 노출 금지: 사용자에게 의미 있는 "무엇을 참조하는지"만 보여줌
            const prev = ch.previous || null;
            const curr = ch.current || null;
            const prevIds = this.extractReqIds(prev);
            const currIds = this.extractReqIds(curr);

            const prevSet = new Set([...prevIds.inputs.map((x) => `I:${x}`), ...prevIds.decisions.map((x) => `D:${x}`)]);
            const currSet = new Set([...currIds.inputs.map((x) => `I:${x}`), ...currIds.decisions.map((x) => `D:${x}`)]);

            const added = Array.from(currSet).filter((k) => !prevSet.has(k));
            const removed = Array.from(prevSet).filter((k) => !currSet.has(k));

            const mapPrev = this.buildIdNameMapFromDmn(this.previous);
            const mapCurr = this.buildIdNameMapFromDmn(this.current);
            const resolve = (k) => {
                const [t, id] = k.split(':');
                const name = (mapCurr[id] || mapPrev[id]) || id;
                return `${t === 'I' ? '입력' : '결정'} ${name}`;
            };

            if (ch.type === 'added') {
                const all = Array.from(currSet).map(resolve);
                return all.length ? all.join(', ') : '';
            }
            if (ch.type === 'removed') {
                const all = Array.from(prevSet).map(resolve);
                return all.length ? all.join(', ') : '';
            }
            if (ch.type === 'modified') {
                if (added.length === 0 && removed.length === 0) return '';
                const parts = [];
                if (added.length) parts.push(`+${added.map(resolve).join(', ')}`);
                if (removed.length) parts.push(`-${removed.map(resolve).join(', ')}`);
                return parts.join(' · ');
            }
            return '';
        },
        expressionSummaryText(ch) {
            // raw FEEL/Expression text는 그대로 노출하지 않음(금지). 상태 변화만 요약.
            const prev = ch.previous?.literalExpression || null;
            const curr = ch.current?.literalExpression || null;
            const prevText = prev?.text || '';
            const currText = curr?.text || '';

            if (ch.type === 'added') return curr ? '추가됨' : '';
            if (ch.type === 'removed') return prev ? '삭제됨' : '';
            if (ch.type === 'modified') {
                if (!!prev !== !!curr) return curr ? '추가됨' : '삭제됨';
                if (prev && curr && prevText !== currText) return '변경됨';
            }
            return '';
        },
        scrollToSection(id) {
            try {
                const el = document.getElementById(id);
                if (el && el.scrollIntoView) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            } catch (e) {
                // ignore
            }
        }
    }
};
</script>

<style scoped>
.dmn-diff-view {
    width: 100%;
    background-color: rgba(var(--v-theme-primary), 0.04);
}

.dmn-header-box {
    background-color: rgba(var(--v-theme-surface), 1);
    border-radius: 4px;
    padding: 8px 12px;
    border: 1px solid rgba(var(--v-border-color), 0.12);
    margin-bottom: 0;
}

.dmn-table-comparison {
    width: 100%;
}

.dmn-table-container {
    background-color: rgba(var(--v-theme-surface), 1);
    border-radius: 4px;
    padding: 8px;
    border: 1px solid rgba(var(--v-border-color), 0.12);
    overflow-x: auto;
    max-height: 500px;
    overflow-y: auto;
}

.dmn-decision-table {
    width: 100%;
    border-collapse: collapse;
}

.dmn-decision-table :deep(thead) {
    background-color: rgba(var(--v-theme-surface-variant), 0.3);
    position: sticky;
    top: 0;
    z-index: 1;
}

.dmn-decision-table :deep(th) {
    padding: 8px 12px;
    text-align: center;
    font-weight: 600;
    font-size: 12px;
    border: 1px solid rgba(var(--v-border-color), 0.12);
    white-space: nowrap;
}

.dmn-input-header {
    background-color: rgba(33, 150, 243, 0.1);
    color: rgba(33, 150, 243, 1);
}

.dmn-output-header {
    background-color: rgba(76, 175, 80, 0.1);
    color: rgba(76, 175, 80, 1);
}

.dmn-decision-table :deep(td) {
    padding: 8px 12px;
    text-align: center;
    font-size: 12px;
    border: 1px solid rgba(var(--v-border-color), 0.12);
    white-space: nowrap;
}

.dmn-input-cell {
    background-color: rgba(33, 150, 243, 0.05);
}

.dmn-output-cell {
    background-color: rgba(76, 175, 80, 0.05);
}

.dmn-rule-row {
    transition: background-color 0.2s;
}

.dmn-rule-row:hover {
    background-color: rgba(var(--v-theme-primary), 0.05);
}

.dmn-row-added {
    background-color: rgba(76, 175, 80, 0.15) !important;
}

.dmn-row-modified {
    background-color: rgba(255, 152, 0, 0.15) !important;
}

.dmn-cell-added {
    background-color: rgba(76, 175, 80, 0.2) !important;
    font-weight: 600;
}

.dmn-cell-modified {
    background-color: rgba(255, 152, 0, 0.2) !important;
    font-weight: 600;
}

.dmn-added {
    background-color: rgba(76, 175, 80, 0.1) !important;
    border-left: 3px solid rgba(76, 175, 80, 0.5) !important;
}

.dmn-modified {
    background-color: rgba(255, 152, 0, 0.1) !important;
    border-left: 3px solid rgba(255, 152, 0, 0.5) !important;
}

.text-truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.dmn-report-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.dmn-report-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.dmn-report-card {
    background-color: rgba(var(--v-theme-surface), 1);
    border-radius: 6px;
    padding: 12px;
    border: 1px solid rgba(var(--v-border-color), 0.12);
}

.dmn-meta-block {
    background-color: rgba(var(--v-theme-background), 1);
    border-radius: 6px;
    padding: 10px;
    border: 1px solid rgba(var(--v-border-color), 0.08);
}

.dmn-info-row .text-medium-emphasis {
    display: inline-block;
    min-width: 40px;
    margin-right: 8px;
}

.dmn-removed-soft {
    opacity: 0.85;
}

.dmn-report-sublist {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.dmn-report-subcard {
    background-color: rgba(var(--v-theme-background), 1);
    border-radius: 6px;
    padding: 10px;
    border: 1px solid rgba(var(--v-border-color), 0.08);
}

.summary-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
}
</style>


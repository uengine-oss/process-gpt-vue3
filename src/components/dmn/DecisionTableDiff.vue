<template>
    <div class="decision-table-diff">
        <!-- Hit Policy (라벨 최소화) -->
        <div class="mb-2">
            <div v-if="prevTable || currTable" class="d-flex align-center ga-2">
                <div class="text-caption text-medium-emphasis">정책</div>
                <v-chip v-if="prevTable" size="x-small" variant="tonal">{{ prevTable.hitPolicy || 'UNIQUE' }}</v-chip>
                <span v-if="prevTable && currTable" class="text-caption text-medium-emphasis">→</span>
                <v-chip v-if="currTable" size="x-small" variant="tonal"
                        :color="(!prevTable && currTable) ? 'success' : (prevTable && currTable && prevTable.hitPolicy !== currTable.hitPolicy) ? 'warning' : undefined">
                    {{ currTable.hitPolicy || 'UNIQUE' }}
                </v-chip>
            </div>
        </div>

        <!-- Decision Table 비교 -->
        <div class="dmn-table-comparison">
            <v-row class="ma-0">
                <!-- 수정(전/후 비교) -->
                <template v-if="prevTable && currTable">
                    <v-col cols="6" class="px-2 py-0">
                        <div v-if="prevTable && (prevTable.rules?.length || prevTable.inputs?.length || prevTable.outputs?.length)" class="dmn-table-container">
                            <v-table density="compact" class="dmn-decision-table">
                                <thead>
                                    <tr>
                                        <th v-for="(input, idx) in prevTable.inputs" :key="'prev-input-' + idx" class="dmn-input-header">
                                            {{ input.label || input.expression || `조건${idx + 1}` }}
                                        </th>
                                        <th v-for="(output, idx) in prevTable.outputs" :key="'prev-output-' + idx" class="dmn-output-header">
                                            {{ output.label || output.name || `결과${idx + 1}` }}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(rule, ruleIdx) in prevTable.rules" :key="'prev-rule-' + ruleIdx" class="dmn-rule-row">
                                        <td v-for="(input, inputIdx) in prevTable.inputs" :key="'prev-cell-' + ruleIdx + '-' + inputIdx" class="dmn-input-cell">
                                            {{ getRuleInputValue(rule, inputIdx) }}
                                        </td>
                                        <td v-for="(output, outputIdx) in prevTable.outputs" :key="'prev-out-cell-' + ruleIdx + '-' + outputIdx" class="dmn-output-cell">
                                            {{ getRuleOutputValue(rule, outputIdx) }}
                                        </td>
                                    </tr>
                                </tbody>
                            </v-table>
                        </div>
                        <div v-else class="text-body-2 text-medium-emphasis pa-4 text-center">규칙이 없습니다</div>
                    </v-col>

                    <v-col cols="6" class="px-2 py-0">
                        <div v-if="currTable && (currTable.rules?.length || currTable.inputs?.length || currTable.outputs?.length)" class="dmn-table-container">
                            <v-table density="compact" class="dmn-decision-table">
                                <thead>
                                    <tr>
                                        <th v-for="(input, idx) in currTable.inputs"
                                            :key="'curr-input-' + idx"
                                            class="dmn-input-header"
                                            :class="{ 'dmn-added': isColumnAdded('input', idx), 'dmn-modified': isColumnModified('input', idx) }">
                                            {{ input.label || input.expression || `조건${idx + 1}` }}
                                        </th>
                                        <th v-for="(output, idx) in currTable.outputs"
                                            :key="'curr-output-' + idx"
                                            class="dmn-output-header"
                                            :class="{ 'dmn-added': isColumnAdded('output', idx), 'dmn-modified': isColumnModified('output', idx) }">
                                            {{ output.label || output.name || `결과${idx + 1}` }}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(rule, ruleIdx) in currTable.rules"
                                        :key="'curr-rule-' + (rule.id || ruleIdx)"
                                        class="dmn-rule-row"
                                        :class="getRuleRowClass(rule, ruleIdx)">
                                        <td v-for="(input, inputIdx) in currTable.inputs"
                                            :key="'curr-cell-' + ruleIdx + '-' + inputIdx"
                                            class="dmn-input-cell"
                                            :class="getRuleCellClass(rule, ruleIdx, inputIdx, 'input')">
                                            {{ getRuleInputValue(rule, inputIdx) }}
                                        </td>
                                        <td v-for="(output, outputIdx) in currTable.outputs"
                                            :key="'curr-out-cell-' + ruleIdx + '-' + outputIdx"
                                            class="dmn-output-cell"
                                            :class="getRuleCellClass(rule, ruleIdx, outputIdx, 'output')">
                                            {{ getRuleOutputValue(rule, outputIdx) }}
                                        </td>
                                    </tr>
                                </tbody>
                            </v-table>
                        </div>
                        <div v-else class="text-body-2 text-medium-emphasis pa-4 text-center">규칙이 없습니다</div>
                    </v-col>
                </template>

                <!-- 추가/삭제(한쪽만 표시) -->
                <template v-else>
                    <v-col cols="12" class="px-2 py-0">
                        <div v-if="singleTable && (singleTable.rules?.length || singleTable.inputs?.length || singleTable.outputs?.length)" class="dmn-table-container">
                            <v-table density="compact" class="dmn-decision-table">
                                <thead>
                                    <tr>
                                        <th v-for="(input, idx) in singleTable.inputs" :key="'single-input-' + idx" class="dmn-input-header">
                                            {{ input.label || input.expression || `조건${idx + 1}` }}
                                        </th>
                                        <th v-for="(output, idx) in singleTable.outputs" :key="'single-output-' + idx" class="dmn-output-header">
                                            {{ output.label || output.name || `결과${idx + 1}` }}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(rule, ruleIdx) in singleTable.rules" :key="'single-rule-' + (rule.id || ruleIdx)" class="dmn-rule-row">
                                        <td v-for="(input, inputIdx) in singleTable.inputs" :key="'single-cell-' + ruleIdx + '-' + inputIdx" class="dmn-input-cell">
                                            {{ getRuleInputValue(rule, inputIdx) }}
                                        </td>
                                        <td v-for="(output, outputIdx) in singleTable.outputs" :key="'single-out-cell-' + ruleIdx + '-' + outputIdx" class="dmn-output-cell">
                                            {{ getRuleOutputValue(rule, outputIdx) }}
                                        </td>
                                    </tr>
                                </tbody>
                            </v-table>
                        </div>
                        <div v-else class="text-body-2 text-medium-emphasis pa-4 text-center">규칙이 없습니다</div>
                    </v-col>
                </template>
            </v-row>
        </div>
    </div>
</template>

<script>
import { isRuleEqual } from '@/utils/dmnParser';

export default {
    name: 'DecisionTableDiff',
    props: {
        previous: {
            type: Object,
            default: null
        },
        current: {
            type: Object,
            default: null
        }
    },
    computed: {
        prevTable() {
            return this.previous || null;
        },
        currTable() {
            return this.current || null;
        },
        singleTable() {
            return this.currTable || this.prevTable || null;
        }
    },
    methods: {
        getRuleInputValue(rule, inputIndex) {
            if (!rule || !rule.inputs || inputIndex >= rule.inputs.length) return '-';
            const value = rule.inputs[inputIndex]?.value || '';
            return value || '-';
        },
        getRuleOutputValue(rule, outputIndex) {
            if (!rule || !rule.outputs || outputIndex >= rule.outputs.length) return '-';
            const value = rule.outputs[outputIndex]?.value || '';
            return value || '-';
        },
        isColumnAdded(type, idx) {
            const prevArr = type === 'input' ? (this.prevTable?.inputs || []) : (this.prevTable?.outputs || []);
            const currArr = type === 'input' ? (this.currTable?.inputs || []) : (this.currTable?.outputs || []);
            if (!this.prevTable) return currArr[idx] != null;
            return idx >= prevArr.length;
        },
        isColumnModified(type, idx) {
            const prevArr = type === 'input' ? (this.prevTable?.inputs || []) : (this.prevTable?.outputs || []);
            const currArr = type === 'input' ? (this.currTable?.inputs || []) : (this.currTable?.outputs || []);
            const p = prevArr[idx];
            const c = currArr[idx];
            if (!p || !c) return false;
            if (type === 'input') return (p.label !== c.label) || (p.expression !== c.expression) || (p.typeRef !== c.typeRef);
            return (p.label !== c.label) || (p.name !== c.name) || (p.typeRef !== c.typeRef);
        },
        findPrevRuleForCurrent(currRule, currIdx) {
            const id = currRule?.id;
            if (id && this.prevTable?.rules?.length) {
                const found = this.prevTable.rules.find((r) => r && r.id === id);
                if (found) return found;
            }
            return this.prevTable?.rules?.[currIdx] || null;
        },
        getRuleRowClass(rule, ruleIdx) {
            const prevRule = this.findPrevRuleForCurrent(rule, ruleIdx);
            if (!prevRule) return 'dmn-row-added';
            if (!isRuleEqual(prevRule, rule)) return 'dmn-row-modified';
            return '';
        },
        getRuleCellClass(rule, ruleIdx, cellIdx, type) {
            const prevRule = this.findPrevRuleForCurrent(rule, ruleIdx);
            if (!prevRule) return 'dmn-cell-added';
            if (type === 'input') {
                const prevValue = this.getRuleInputValue(prevRule, cellIdx);
                const currValue = this.getRuleInputValue(rule, cellIdx);
                if (prevValue !== currValue) return 'dmn-cell-modified';
            } else {
                const prevValue = this.getRuleOutputValue(prevRule, cellIdx);
                const currValue = this.getRuleOutputValue(rule, cellIdx);
                if (prevValue !== currValue) return 'dmn-cell-modified';
            }
            return '';
        }
    }
};
</script>

<style scoped>
.decision-table-diff {
    width: 100%;
}

.dmn-header-box {
    background-color: rgba(var(--v-theme-surface), 1);
    border-radius: 4px;
    padding: 8px 12px;
    border: 1px solid rgba(var(--v-border-color), 0.12);
    margin-bottom: 0;
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

.dmn-decision-table :deep(th),
.dmn-decision-table :deep(td) {
    padding: 8px 12px;
    text-align: center;
    font-size: 12px;
    border: 1px solid rgba(var(--v-border-color), 0.12);
    white-space: nowrap;
}

.dmn-input-header {
    background-color: rgba(33, 150, 243, 0.1);
    color: rgba(33, 150, 243, 1);
    font-weight: 600;
}

.dmn-output-header {
    background-color: rgba(76, 175, 80, 0.1);
    color: rgba(76, 175, 80, 1);
    font-weight: 600;
}

.dmn-input-cell {
    background-color: rgba(33, 150, 243, 0.05);
}

.dmn-output-cell {
    background-color: rgba(76, 175, 80, 0.05);
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

.dmn-removed-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.dmn-rule-item {
    padding: 12px;
    background-color: rgba(var(--v-theme-background), 1);
    border-radius: 4px;
    border-left: 3px solid rgba(var(--v-theme-primary), 0.3);
}

.dmn-removed {
    background-color: rgba(244, 67, 54, 0.1) !important;
    border-left-color: rgba(244, 67, 54, 0.5) !important;
    text-decoration: line-through;
    opacity: 0.8;
}
</style>



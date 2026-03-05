<template>
    <div class="dmn-structure-view">
        <!-- Definitions -->
        <div class="mb-2">
            <div class="dmn-header-box">
                <div class="text-body-2 font-weight-medium mb-1">{{ dmn.definitions?.name || '-' }}</div>
                <div class="text-caption text-medium-emphasis mb-1">{{ dmn.definitions?.namespace || '-' }}</div>
                <div class="text-caption text-medium-emphasis">
                    InputData: {{ (dmn.inputData || []).length }}개 · Decision: {{ (dmn.decisions || []).length }}개
                </div>
            </div>
        </div>

        <!-- InputData -->
        <div class="mb-2">
            <div class="text-body-2 font-weight-medium mb-1">입력 데이터</div>
            <div v-if="(dmn.inputData || []).length > 0" class="dmn-list-box">
                <div v-for="input in dmn.inputData" :key="input.id" class="dmn-item mb-2">
                    <div class="text-body-2 font-weight-medium">{{ input.name || '-' }}</div>
                    <div class="text-caption text-medium-emphasis">{{ input.id }}</div>
                    <div v-if="input.variable" class="text-caption mt-1">
                        변수: {{ input.variable.name || '-' }} ({{ input.variable.typeRef || '-' }})
                    </div>
                </div>
            </div>
            <div v-else class="text-body-2 text-medium-emphasis">없음</div>
        </div>

        <!-- Decisions -->
        <div class="mb-2">
            <div class="text-body-2 font-weight-medium mb-1">결정</div>
            <v-expansion-panels v-if="(dmn.decisions || []).length > 0" variant="accordion" multiple>
                <v-expansion-panel v-for="decision in dmn.decisions" :key="decision.id">
                    <v-expansion-panel-title>
                        <div class="d-flex flex-column">
                            <div class="text-body-2 font-weight-medium">{{ decision.name || '-' }}</div>
                            <div class="text-caption text-medium-emphasis">{{ decision.id }}</div>
                        </div>
                    </v-expansion-panel-title>
                    <v-expansion-panel-text>
                        <!-- DecisionTable -->
                        <div v-if="decision.decisionTable" class="mb-2">
                            <div class="text-caption text-medium-emphasis mb-1">정책: {{ decision.decisionTable.hitPolicy || 'UNIQUE' }}</div>
                            <div class="dmn-table-container">
                                <v-table density="compact" class="dmn-decision-table">
                                    <thead>
                                        <tr>
                                            <th v-for="(input, idx) in decision.decisionTable.inputs" :key="'input-' + decision.id + '-' + idx" class="dmn-input-header">
                                                {{ input.label || input.expression || `조건${idx + 1}` }}
                                            </th>
                                            <th v-for="(output, idx) in decision.decisionTable.outputs" :key="'output-' + decision.id + '-' + idx" class="dmn-output-header">
                                                {{ output.label || output.name || `결과${idx + 1}` }}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="(rule, ruleIdx) in decision.decisionTable.rules" :key="'rule-' + decision.id + '-' + ruleIdx" class="dmn-rule-row">
                                            <td v-for="(input, inputIdx) in decision.decisionTable.inputs" :key="'cell-' + decision.id + '-' + ruleIdx + '-' + inputIdx" class="dmn-input-cell">
                                                {{ getRuleInputValue(rule, inputIdx) }}
                                            </td>
                                            <td v-for="(output, outputIdx) in decision.decisionTable.outputs" :key="'outcell-' + decision.id + '-' + ruleIdx + '-' + outputIdx" class="dmn-output-cell">
                                                {{ getRuleOutputValue(rule, outputIdx) }}
                                            </td>
                                        </tr>
                                    </tbody>
                                </v-table>
                            </div>
                        </div>

                        <!-- LiteralExpression -->
                        <div v-else-if="decision.literalExpression" class="dmn-info-box">
                            <div class="text-caption text-medium-emphasis mb-1">Expression</div>
                            <pre class="expression-text">{{ decision.literalExpression.text || '-' }}</pre>
                        </div>

                        <div v-else class="text-body-2 text-medium-emphasis">표시할 내용이 없습니다.</div>
                    </v-expansion-panel-text>
                </v-expansion-panel>
            </v-expansion-panels>
            <div v-else class="text-body-2 text-medium-emphasis">없음</div>
        </div>

        <!-- DMNDI는 논리 모델 변경 확인 목적에선 제외 -->
    </div>
</template>

<script>
export default {
    name: 'DmnStructureView',
    props: {
        dmn: {
            type: Object,
            required: true
        }
    },
    methods: {
        getRuleInputValue(rule, inputIndex) {
            if (!rule || !rule.inputs || inputIndex >= rule.inputs.length) {
                return '-';
            }
            const value = rule.inputs[inputIndex]?.value || '';
            return value || '-';
        },

        getRuleOutputValue(rule, outputIndex) {
            if (!rule || !rule.outputs || outputIndex >= rule.outputs.length) {
                return '-';
            }
            const value = rule.outputs[outputIndex]?.value || '';
            return value || '-';
        }
    }
};
</script>

<style scoped>
.dmn-structure-view {
    width: 100%;
}

.dmn-header-box {
    background-color: rgba(var(--v-theme-surface), 1);
    border-radius: 4px;
    padding: 8px 12px;
    border: 1px solid rgba(var(--v-border-color), 0.12);
    margin-bottom: 0;
}

.dmn-info-box {
    background-color: rgba(var(--v-theme-surface), 1);
    border-radius: 4px;
    padding: 12px;
    border: 1px solid rgba(var(--v-border-color), 0.12);
}

.dmn-list-box {
    background-color: rgba(var(--v-theme-surface), 1);
    border-radius: 4px;
    padding: 12px;
    border: 1px solid rgba(var(--v-border-color), 0.12);
    max-height: 300px;
    overflow-y: auto;
}

.dmn-item {
    padding: 8px;
    background-color: rgba(var(--v-theme-background), 1);
    border-radius: 4px;
    border-left: 3px solid rgba(var(--v-theme-primary), 0.3);
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

.expression-text {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'Courier New', monospace;
    font-size: 12px;
}
</style>


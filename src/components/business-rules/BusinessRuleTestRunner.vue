<template>
    <v-dialog v-model="dialog" max-width="900px" persistent scrollable>
        <v-card>
            <v-card-title class="d-flex align-center">
                <v-icon class="mr-2" color="primary">mdi-play-circle-outline</v-icon>
                <div class="flex-grow-1 text-left">
                    <div class="text-h6">{{ ruleName || '룰 테스트 실행' }}</div>
                    <div class="text-caption text-medium-emphasis">입력값을 입력하고 룰을 실행하여 결과를 확인합니다.</div>
                </div>
                <v-btn icon variant="text" @click="closeDialog" class="ml-auto">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <v-divider />

            <v-card-text style="max-height: 70vh; overflow-y: auto;">
                <v-container fluid class="pa-4">
                    <!-- 입력값 입력 폼 -->
                    <div v-if="rule && rule.inputs && rule.inputs.length > 0" class="mb-6">
                        <div class="d-flex align-center mb-3">
                            <v-icon class="mr-2" color="primary" size="20">mdi-form-textbox</v-icon>
                            <div class="text-h6">입력값</div>
                        </div>
                        <v-row>
                            <v-col
                                v-for="input in rule.inputs"
                                :key="input.key || input.item"
                                cols="12"
                                :md="6"
                            >
                                <v-text-field
                                    v-if="input.inputMode === 'number'"
                                    v-model.number="testInputs[input.key || input.item]"
                                    :label="input.label || input.key || input.item"
                                    variant="outlined"
                                    density="comfortable"
                                    type="number"
                                    :placeholder="`${input.label || input.key || input.item} 값을 입력하세요`"
                                />
                                <v-select
                                    v-else-if="input.inputMode === 'boolean'"
                                    v-model="testInputs[input.key || input.item]"
                                    :label="input.label || input.key || input.item"
                                    variant="outlined"
                                    density="comfortable"
                                    :items="booleanItems"
                                    item-title="title"
                                    item-value="value"
                                />
                                <v-select
                                    v-else-if="input.inputMode === 'enum' && input.options && input.options.length > 0"
                                    v-model="testInputs[input.key || input.item]"
                                    :label="input.label || input.key || input.item"
                                    variant="outlined"
                                    density="comfortable"
                                    :items="input.options"
                                />
                                <v-text-field
                                    v-else-if="input.inputMode === 'date'"
                                    v-model="testInputs[input.key || input.item]"
                                    :label="input.label || input.key || input.item"
                                    variant="outlined"
                                    density="comfortable"
                                    type="date"
                                />
                                <v-text-field
                                    v-else-if="input.inputMode === 'time'"
                                    v-model="testInputs[input.key || input.item]"
                                    :label="input.label || input.key || input.item"
                                    variant="outlined"
                                    density="comfortable"
                                    type="time"
                                />
                                <v-text-field
                                    v-else-if="input.inputMode === 'dateTime'"
                                    v-model="testInputs[input.key || input.item]"
                                    :label="input.label || input.key || input.item"
                                    variant="outlined"
                                    density="comfortable"
                                    type="datetime-local"
                                />
                                <v-text-field
                                    v-else
                                    v-model="testInputs[input.key || input.item]"
                                    :label="input.label || input.key || input.item"
                                    variant="outlined"
                                    density="comfortable"
                                    :placeholder="`${input.label || input.key || input.item} 값을 입력하세요`"
                                />
                            </v-col>
                        </v-row>
                    </div>

                    <div v-else class="text-medium-emphasis mb-6">
                        이 룰에는 입력 항목이 정의되어 있지 않습니다.
                    </div>

                    <!-- 결과 표시 영역 -->
                    <v-divider class="my-6" />

                    <div v-if="executionResult" class="mb-6">
                        <div class="d-flex align-center mb-3">
                            <v-icon class="mr-2" color="success" size="20">mdi-check-circle</v-icon>
                            <div class="text-h6">실행 결과</div>
                        </div>
                        <v-card variant="outlined" class="pa-4" elevation="0">
                            <v-row class="mb-3">
                                <v-col cols="12" md="6">
                                    <div class="text-caption text-medium-emphasis mb-2">결과</div>
                                    <v-chip
                                        :color="getOutcomeColor(executionResult.outcome)"
                                        variant="tonal"
                                        size="large"
                                        class="text-h6"
                                    >
                                        <v-icon start size="small">{{ getOutcomeIcon(executionResult.outcome) }}</v-icon>
                                        {{ getOutcomeLabel(executionResult.outcome) }}
                                    </v-chip>
                                </v-col>
                                <v-col v-if="executionResult.executionTime" cols="12" md="6">
                                    <div class="text-caption text-medium-emphasis mb-2">실행 시간</div>
                                    <div class="text-body-1 font-weight-medium">{{ executionResult.executionTime }}ms</div>
                                </v-col>
                            </v-row>
                            <v-row v-if="executionResult.note">
                                <v-col cols="12">
                                    <div class="text-caption text-medium-emphasis mb-2">설명</div>
                                    <div class="text-body-1">{{ executionResult.note }}</div>
                                </v-col>
                            </v-row>
                            <v-row v-if="executionResult.matchedRuleIndex !== undefined && matchedRule">
                                <v-col cols="12">
                                    <v-divider class="my-3" />
                                    <div class="text-caption text-medium-emphasis mb-2">매칭된 규칙</div>
                                    <v-card variant="tonal" :color="getOutcomeColor(executionResult.outcome)" class="pa-3" elevation="0">
                                        <div class="d-flex align-center mb-2">
                                            <v-icon class="mr-2" size="small">mdi-filter</v-icon>
                                            <span class="text-subtitle-2 font-weight-bold">규칙 #{{ executionResult.matchedRuleIndex + 1 }}</span>
                                        </div>
                                        <div v-if="matchedRule.conditions && matchedRule.conditions.length > 0" class="mb-2">
                                            <div class="text-caption text-medium-emphasis mb-1">조건</div>
                                            <div class="text-body-2">
                                                <span
                                                    v-for="(condition, idx) in matchedRule.conditions"
                                                    :key="idx"
                                                    class="mr-2"
                                                >
                                                    <v-chip size="small" variant="outlined" class="mr-1 mb-1">
                                                        {{ getInputLabel(condition.key) }} {{ getOperatorLabel(condition.operator) }} {{ formatConditionValue(condition.value) }}
                                                    </v-chip>
                                                </span>
                                            </div>
                                        </div>
                                        <div v-if="matchedRule.result">
                                            <div class="text-caption text-medium-emphasis mb-1">결과</div>
                                            <div class="text-body-2">
                                                <v-chip size="small" :color="getOutcomeColor(matchedRule.result.outcome)" variant="tonal" class="mr-1">
                                                    {{ getOutcomeLabel(matchedRule.result.outcome) }}
                                                </v-chip>
                                                <span v-if="matchedRule.result.note" class="text-medium-emphasis">{{ matchedRule.result.note }}</span>
                                            </div>
                                        </div>
                                    </v-card>
                                </v-col>
                            </v-row>
                        </v-card>
                    </div>

                    <div v-else-if="isExecuting" class="text-center py-8">
                        <v-progress-circular indeterminate color="primary" size="48" class="mb-4" />
                        <div class="text-medium-emphasis">룰을 실행하고 있습니다...</div>
                    </div>

                    <div v-else class="text-center py-8">
                        <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-play-circle-outline</v-icon>
                        <div class="text-medium-emphasis">실행 버튼을 클릭하여 룰을 테스트하세요.</div>
                    </div>

                    <!-- 테스트 케이스 목록 -->
                    <v-divider class="my-6" />

                    <div class="mb-4">
                        <div class="d-flex align-center mb-3">
                            <v-icon class="mr-2" color="primary" size="20">mdi-bookmark-outline</v-icon>
                            <div class="text-h6">저장된 테스트 케이스</div>
                            <v-spacer />
                            <v-btn
                                variant="outlined"
                                size="small"
                                color="primary"
                                @click="showSaveTestCaseDialog = true"
                            >
                                <v-icon start size="small">mdi-content-save</v-icon>
                                저장
                            </v-btn>
                        </div>
                        <v-list v-if="testCases.length > 0" variant="outlined" rounded>
                            <v-list-item
                                v-for="testCase in testCases"
                                :key="testCase.id"
                                @click="loadTestCase(testCase)"
                            >
                                <template #prepend>
                                    <v-icon>mdi-file-document-outline</v-icon>
                                </template>
                                <v-list-item-title>{{ testCase.name }}</v-list-item-title>
                                <v-list-item-subtitle>
                                    {{ formatDate(testCase.updatedAt || testCase.createdAt) }}
                                </v-list-item-subtitle>
                                <template #append>
                                    <v-btn
                                        icon
                                        variant="text"
                                        size="small"
                                        @click.stop="deleteTestCase(testCase.id)"
                                    >
                                        <v-icon size="small">mdi-delete-outline</v-icon>
                                    </v-btn>
                                </template>
                            </v-list-item>
                        </v-list>
                        <div v-else class="text-medium-emphasis text-center py-4">
                            저장된 테스트 케이스가 없습니다.
                        </div>
                    </div>
                </v-container>
            </v-card-text>

            <v-divider />

            <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="closeDialog">닫기</v-btn>
                <v-btn
                    color="primary"
                    variant="flat"
                    :disabled="!canExecute || isExecuting"
                    :loading="isExecuting"
                    @click="executeRule"
                >
                    <v-icon start>mdi-play</v-icon>
                    실행
                </v-btn>
            </v-card-actions>
        </v-card>

        <!-- 테스트 케이스 저장 다이얼로그 -->
        <v-dialog v-model="showSaveTestCaseDialog" max-width="500" persistent>
            <v-card>
                <v-card-title class="text-h6">테스트 케이스 저장</v-card-title>
                <v-card-text>
                    <v-text-field
                        v-model="newTestCaseName"
                        label="테스트 케이스 이름"
                        variant="outlined"
                        density="comfortable"
                        placeholder="예: VIP 고객 승인 테스트"
                        autofocus
                    />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="showSaveTestCaseDialog = false; newTestCaseName = ''">
                        취소
                    </v-btn>
                    <v-btn
                        color="primary"
                        variant="flat"
                        :disabled="!newTestCaseName || !newTestCaseName.trim()"
                        @click="saveTestCase"
                    >
                        저장
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-dialog>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';

export default {
    name: 'business-rule-test-runner',
    props: {
        modelValue: {
            type: Boolean,
            default: false
        },
        ruleId: {
            type: String,
            default: null
        },
        ruleName: {
            type: String,
            default: ''
        }
    },
    emits: ['update:modelValue', 'close'],
    data() {
        return {
            backend: null,
            rule: null,
            testInputs: {},
            executionResult: null,
            isExecuting: false,
            testCases: [],
            showSaveTestCaseDialog: false,
            newTestCaseName: '',
            booleanItems: [
                { title: '예', value: true },
                { title: '아니오', value: false }
            ]
        };
    },
    computed: {
        dialog: {
            get() {
                return this.modelValue;
            },
            set(value) {
                this.$emit('update:modelValue', value);
            }
        },
        canExecute() {
            if (!this.rule || !this.rule.inputs || this.rule.inputs.length === 0) {
                return false;
            }
            // 모든 입력값이 채워져 있는지 확인
            return this.rule.inputs.every((input) => {
                const key = input.key || input.item;
                const value = this.testInputs[key];
                return value !== undefined && value !== null && value !== '';
            });
        },
        matchedRule() {
            if (!this.executionResult || this.executionResult.matchedRuleIndex === undefined) {
                return null;
            }
            if (!this.rule || !this.rule.rules || !Array.isArray(this.rule.rules)) {
                return null;
            }
            const index = this.executionResult.matchedRuleIndex;
            if (index < 0 || index >= this.rule.rules.length) {
                return null;
            }
            return this.rule.rules[index];
        }
    },
    watch: {
        dialog(newVal) {
            if (newVal && this.ruleId) {
                this.loadRule();
                this.loadTestCases();
            } else if (!newVal) {
                this.reset();
            }
        },
        ruleId(newVal) {
            if (newVal && this.dialog) {
                this.loadRule();
                this.loadTestCases();
            }
        }
    },
    created() {
        this.backend = BackendFactory.createBackend();
    },
    methods: {
        async loadRule() {
            if (!this.ruleId) return;
            
            try {
                this.rule = await this.backend.getBusinessRule(this.ruleId);
                if (this.rule && this.rule.inputs) {
                    // 입력값 초기화
                    this.testInputs = {};
                    this.rule.inputs.forEach((input) => {
                        const key = input.key || input.item;
                        if (input.inputMode === 'boolean') {
                            this.testInputs[key] = false;
                        } else if (input.inputMode === 'number') {
                            this.testInputs[key] = 0;
                        } else {
                            this.testInputs[key] = '';
                        }
                    });
                }
            } catch (error) {
                console.error('룰 로드 실패:', error);
                this.notifyError('룰을 불러오는 중 오류가 발생했습니다.');
            }
        },
        async executeRule() {
            if (!this.canExecute || this.isExecuting) return;
            
            this.isExecuting = true;
            this.executionResult = null;
            
            try {
                const result = await this.backend.executeBusinessRule(this.ruleId, this.testInputs);
                this.executionResult = result;
                this.notifySuccess('룰 실행이 완료되었습니다.');
            } catch (error) {
                console.error('룰 실행 실패:', error);
                const errorMessage = (error && error.message) || '룰 실행 중 오류가 발생했습니다.';
                this.notifyError(errorMessage);
            } finally {
                this.isExecuting = false;
            }
        },
        async loadTestCases() {
            if (!this.ruleId) return;
            
            try {
                this.testCases = await this.backend.getRuleTestCases(this.ruleId);
            } catch (error) {
                console.error('테스트 케이스 목록 로드 실패:', error);
            }
        },
        loadTestCase(testCase) {
            this.testInputs = { ...testCase.inputs };
            this.executionResult = null;
        },
        async saveTestCase() {
            if (!this.newTestCaseName || !this.newTestCaseName.trim()) return;
            if (!this.ruleId) return;
            
            try {
                const testCase = {
                    name: this.newTestCaseName.trim(),
                    inputs: { ...this.testInputs },
                    expectedOutcome: this.executionResult && this.executionResult.outcome,
                    expectedNote: this.executionResult && this.executionResult.note
                };
                
                await this.backend.saveRuleTestCase(this.ruleId, testCase);
                this.showSaveTestCaseDialog = false;
                this.newTestCaseName = '';
                await this.loadTestCases();
                this.notifySuccess('테스트 케이스가 저장되었습니다.');
            } catch (error) {
                console.error('테스트 케이스 저장 실패:', error);
                const errorMessage = (error && error.message) || '테스트 케이스 저장 중 오류가 발생했습니다.';
                this.notifyError(errorMessage);
            }
        },
        async deleteTestCase(testCaseId) {
            if (!this.ruleId || !testCaseId) return;
            if (!confirm('이 테스트 케이스를 삭제하시겠습니까?')) return;
            
            try {
                await this.backend.deleteRuleTestCase(this.ruleId, testCaseId);
                await this.loadTestCases();
                this.notifySuccess('테스트 케이스가 삭제되었습니다.');
            } catch (error) {
                console.error('테스트 케이스 삭제 실패:', error);
                const errorMessage = (error && error.message) || '테스트 케이스 삭제 중 오류가 발생했습니다.';
                this.notifyError(errorMessage);
            }
        },
        getOutcomeColor(outcome) {
            switch (outcome) {
                case 'approve':
                    return 'success';
                case 'conditional':
                    return 'warning';
                case 'reject':
                    return 'error';
                default:
                    return 'default';
            }
        },
        getOutcomeLabel(outcome) {
            switch (outcome) {
                case 'approve':
                    return '승인';
                case 'conditional':
                    return '조건부 승인';
                case 'reject':
                    return '거절';
                default:
                    return outcome;
            }
        },
        getOutcomeIcon(outcome) {
            switch (outcome) {
                case 'approve':
                    return 'mdi-check-circle';
                case 'conditional':
                    return 'mdi-alert-circle';
                case 'reject':
                    return 'mdi-close-circle';
                default:
                    return 'mdi-help-circle';
            }
        },
        getInputLabel(key) {
            if (!this.rule || !this.rule.inputs) return key;
            const input = this.rule.inputs.find((i) => (i.key || i.item) === key);
            return input ? (input.label || input.key || input.item || key) : key;
        },
        getOperatorLabel(operator) {
            const operators = {
                'eq': '=',
                'ne': '≠',
                'gt': '>',
                'gte': '≥',
                'lt': '<',
                'lte': '≤',
                'contains': '포함',
                'notContains': '미포함',
                'startsWith': '시작',
                'endsWith': '종료'
            };
            return operators[operator] || operator;
        },
        formatConditionValue(value) {
            if (value === null || value === undefined) return '';
            if (typeof value === 'boolean') return value ? '예' : '아니오';
            return String(value);
        },
        formatDate(dateString) {
            if (!dateString) return '';
            try {
                const date = new Date(dateString);
                return date.toLocaleString('ko-KR');
            } catch (e) {
                return dateString;
            }
        },
        reset() {
            this.testInputs = {};
            this.executionResult = null;
            this.isExecuting = false;
            this.testCases = [];
            this.showSaveTestCaseDialog = false;
            this.newTestCaseName = '';
        },
        closeDialog() {
            this.dialog = false;
            this.$emit('close');
        },
        notifySuccess(message) {
            if (this.$try) {
                this.$try({ context: this, action: async () => {}, successMsg: message });
            } else if (window.$app_) {
                window.$app_.snackbarMessage = message;
                window.$app_.snackbarColor = 'success';
                window.$app_.snackbar = true;
            } else {
                alert(message);
            }
        },
        notifyError(message) {
            if (this.$try) {
                this.$try({ context: this, action: async () => {}, warningMsg: message });
            } else if (window.$app_) {
                window.$app_.snackbarMessage = message;
                window.$app_.snackbarColor = 'error';
                window.$app_.snackbar = true;
            } else {
                alert(message);
            }
        }
    }
};
</script>

<style scoped>
.v-card-text {
    padding: 24px;
}
</style>

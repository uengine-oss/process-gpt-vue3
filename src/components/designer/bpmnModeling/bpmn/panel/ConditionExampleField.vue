<template>
    <div>
        <div class="d-flex justify-space-between align-center">
            <div class="mb-1 mt-4">예시</div>
            <div>
                <v-btn @click="generateExamples" color="primary" density="compact" :disabled="isGenerating">
                    <span v-if="isGenerating" class="thinking-wave-text">
                        <span v-for="(char, index) in '예시 생성 중...' " :key="index" :style="{ animationDelay: `${index * 0.1}s` }" class="thinking-char">
                            {{ char === ' ' ? '\u00A0' : char }}
                        </span>
                    </span>
                    <span v-else>예시 생성</span>
                </v-btn>
            </div>
        </div>
        <div class="table-container">
            <v-table>
                <thead>
                    <tr>
                        <th v-for="header in header" :key="header.key" class="text-center">
                            {{ header.name }}
                        </th>
                        <th class="text-center">작업</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(example, index) in examples" :key="example.id">
                        <td>
                            <v-text-field
                                v-model="example.given"
                                variant="outlined"
                                density="compact"
                                hide-details
                                @input="updateExample(index, 'given', $event.target.value)"
                            />
                        </td>
                        <td>
                            <v-text-field
                                v-model="example.when"
                                variant="outlined"
                                density="compact"
                                hide-details
                                @input="updateExample(index, 'when', $event.target.value)"
                            />
                        </td>
                        <td>
                            <v-text-field
                                v-model="example.then"
                                variant="outlined"
                                density="compact"
                                hide-details
                                @input="updateExample(index, 'then', $event.target.value)"
                            />
                        </td>
                        <td>
                            <v-text-field
                                v-model="example.valid_at"
                                type="datetime-local"
                                variant="outlined"
                                density="compact"
                                hide-details
                                @click="activateDateTimeField($event.target)"
                                @input="updateExample(index, 'valid_at', $event.target.value)"
                            />
                        </td>
                        <td>
                            <v-text-field
                                v-model="example.invalid_at"
                                type="datetime-local"
                                variant="outlined"
                                density="compact"
                                hide-details
                                @click="activateDateTimeField($event.target)"
                                @input="updateExample(index, 'invalid_at', $event.target.value)"
                            />
                        </td>
                        <td class="text-center">
                            <v-btn
                                icon="mdi-delete"
                                variant="text"
                                color="error"
                                size="small"
                                @click="removeRow(index)"
                            />
                        </td>
                    </tr>
                </tbody>
            </v-table>
        </div>
        
        <div class="d-flex justify-center mt-3">
            <v-btn
                color="primary"
                variant="outlined"
                prepend-icon="mdi-plus"
                @click="addNewRow"
            >
                새 행 추가
            </v-btn>
        </div>
    </div>
</template>

<script>
import ChatModule from "@/components/ChatModule.vue";
import ConditionExampleGenenrator from '@/components/ai/ConditionExampleGenenrator';
import BackendFactory from '@/components/api/BackendFactory';

export default {
    mixins: [ChatModule],
    props: {
        value: Array,
        processDefinitionId: String,
        condition: String
    },
    data() {
        return {
            header: [
                { key: 'given', name: 'Given' },
                { key: 'when', name: 'When' },
                { key: 'then', name: 'Then' },
                { key: 'valid_at', name: 'Valid At' },
                { key: 'invalid_at', name: 'Invalid At' }
            ],
            examples: [],
            backend: null,
            genenrator: null,
            processDefinition: null,
            isGenerating: false
        };
    },
    watch: {
        value: {
            handler(newVal) {
                this.examples = newVal.map(example => ({
                    ...example,
                    valid_at: example.valid_at ? example.valid_at : null,
                    invalid_at: example.invalid_at ? example.invalid_at : null
                }));
                console.log(this.examples)
            },
            deep: true
        }
    },
    async mounted() {
        this.backend = BackendFactory.createBackend();

        if (this.value) {
            this.examples = this.value.map(example => ({
                ...example,
                valid_at: example.valid_at ? example.valid_at : null,
                invalid_at: example.invalid_at ? example.invalid_at : null
            }));
        } else {
            this.examples = [];
        }

        const process = await this.backend.getRawDefinition(this.processDefinitionId);
        this.processDefinition = process.definition;

        this.genenrator = new ConditionExampleGenenrator(this, {
            isStream: true,
            preferredLanguage: "Korean",
            processDefinition: this.processDefinition,
            condition: this.condition
        });
    },  
    methods: {
        async generateExamples() {
            this.isGenerating = true;
            await this.genenrator.generate();
        },
        afterModelStopped(response) {
            // console.log(response)
        },
        afterModelCreated(response) {
            // console.log(response)
        },
        async afterGenerationFinished(responseObj) {
            this.isGenerating = false;
            if (responseObj) {
                this.examples = responseObj.examples;
                this.$emit('update:value', this.examples);
            }
        },
        updateExample(index, key, value) {
            console.log(value)
            this.examples[index][key] = value;
            this.$emit('update:value', this.examples);
        },
        addNewRow() {
            this.examples.push({
                given: '',
                when: '',
                then: '',
                valid_at: '',
                invalid_at: ''
            });
            this.$emit('update:value', this.examples);
        },
        removeRow(index) {
            this.examples.splice(index, 1);
            this.$emit('update:value', this.examples);
        },
        activateDateTimeField(target) {
            // datetime-local 입력 필드를 클릭했을 때 바로 활성화
            if (target.type === 'datetime-local') {
                target.showPicker();
            }
        }
    }
};
</script>

<style scoped>
.table-container {
    overflow-x: auto;
    max-width: 100%;
}

.table-container table {
    min-width: 800px;
}

/* 테이블 셀들이 내용에 맞게 적절한 너비를 가지도록 */
.table-container td {
    white-space: nowrap;
    min-width: 120px;
}

/* datetime 컬럼은 조금 더 넓게 */
.table-container td:nth-child(4),
.table-container td:nth-child(5) {
    min-width: 180px;
}

/* 작업 컬럼은 고정 너비 */
.table-container td:last-child {
    min-width: 80px;
    width: 80px;
}
</style>

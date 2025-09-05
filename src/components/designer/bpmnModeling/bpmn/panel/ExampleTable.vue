<template>
    <div>
        <div class="d-flex justify-space-between align-center">
            <div class="mb-1 mt-4">
                <v-icon :icon="icon" size="small" :color="type === 'good' ? 'success' : 'error'" />
                <span class="ml-2">{{ title }}</span>
            </div>
        </div>
        <div class="table-container">
            <v-table>
                <thead>
                    <tr>
                        <th v-for="header in headers" :key="header.key" class="text-center">
                            {{ header.name }}
                        </th>
                        <th class="text-center">작업</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(example, index) in examples" :key="index">
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
                        <td class="text-center">
                            <v-btn
                                icon="mdi-calendar-edit"
                                variant="text"
                                color="primary"
                                size="small"
                                @click="openDateTimeDialog(index)"
                            />
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
                새 예시 추가
            </v-btn>
        </div>

        <!-- 날짜/시간 설정 다이얼로그 -->
        <v-dialog v-model="dateTimeDialog" max-width="400px">
            <v-card>
                <v-card-title>
                    <span class="text-h5">유효 기간 설정</span>
                </v-card-title>
                <v-card-text>
                    <v-container>
                        <v-row>
                            <v-col cols="12">
                                <v-text-field
                                    v-model="editingExample.valid_at"
                                    label="유효 시작일"
                                    type="datetime-local"
                                    variant="outlined"
                                    prepend-icon="mdi-calendar-start"
                                />
                            </v-col>
                            <v-col cols="12">
                                <v-text-field
                                    v-model="editingExample.invalid_at"
                                    label="유효 종료일"
                                    type="datetime-local"
                                    variant="outlined"
                                    prepend-icon="mdi-calendar-end"
                                />
                            </v-col>
                        </v-row>
                    </v-container>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn
                        color="blue darken-1"
                        text
                        @click="closeDateTimeDialog"
                    >
                        취소
                    </v-btn>
                    <v-btn
                        color="blue darken-1"
                        text
                        @click="saveDateTimeSettings"
                    >
                        저장
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
export default {
    name: 'ExampleTable',
    props: {
        type: {
            type: String,
            required: true
        },
        examples: {
            type: Array,
            required: true
        },
        headers: {
            type: Array,
            required: true
        }
    },
    data() {
        return {
            dateTimeDialog: false,
            editingIndex: -1,
            editingExample: {
                valid_at: '',
                invalid_at: ''
            }
        };
    },
    computed: {
        icon() {
            return this.title === '좋은 예시' ? 'mdi-check-circle-outline' : 'mdi-cancel';
        },
        title() {
            return this.type === 'good' ? '좋은 예시' : '나쁜 예시';
        }
    },
    methods: {
        updateExample(index, key, value) {
            const updatedExamples = [...this.examples];
            updatedExamples[index][key] = value;
            this.$emit('update:examples', updatedExamples);
        },
        addNewRow() {
            const newExample = {
                when: '',
                then: '',
                valid_at: '',
                invalid_at: ''
            };
            const updatedExamples = [...this.examples, newExample];
            this.$emit('update:examples', updatedExamples);
        },
        removeRow(index) {
            this.$emit('remove-row', index);
        },
        openDateTimeDialog(index) {
            this.editingIndex = index;
            this.editingExample = {
                valid_at: this.examples[index].valid_at || '',
                invalid_at: this.examples[index].invalid_at || ''
            };
            this.dateTimeDialog = true;
        },
        closeDateTimeDialog() {
            this.dateTimeDialog = false;
            this.editingIndex = -1;
            this.editingExample = {
                valid_at: '',
                invalid_at: ''
            };
        },
        saveDateTimeSettings() {
            if (this.editingIndex >= 0) {
                this.updateExample(this.editingIndex, 'valid_at', this.editingExample.valid_at);
                this.updateExample(this.editingIndex, 'invalid_at', this.editingExample.invalid_at);
            }
            this.closeDateTimeDialog();
        },
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

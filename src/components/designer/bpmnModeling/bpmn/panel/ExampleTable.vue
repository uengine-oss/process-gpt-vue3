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
                given: '',
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

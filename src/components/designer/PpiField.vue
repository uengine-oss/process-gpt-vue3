<template>
    <div class="ppi-field">
        <div class="d-flex align-center mb-2">
            <h6 class="text-body-1">{{ $t('ppi.title') || 'PPI (프로세스 성과지표)' }}</h6>
            <v-spacer />
            <span class="ppi-hint">{{ $t('ppi.hint') || '이 프로세스의 성과를 측정하는 지표(PPI)를 정의합니다.' }}</span>
        </div>

        <!-- 조회(ReadOnly) 뷰: 성과지표 테이블 -->
        <template v-if="readonly">
            <v-table v-if="local.length > 0" density="compact" class="ppi-view-table">
                <thead>
                    <tr>
                        <th>{{ $t('ppi.name') || '지표명' }}</th>
                        <th>{{ $t('ppi.unit') || '단위' }}</th>
                        <th>{{ $t('ppi.cycle') || '측정주기' }}</th>
                        <th>{{ $t('ppi.definition') || '운영정의' }}</th>
                        <th>{{ $t('ppi.formula') || '산출식' }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(item, index) in local" :key="index">
                        <td class="font-weight-medium">{{ item.name }}</td>
                        <td>{{ item.unit }}</td>
                        <td>{{ item.cycle }}</td>
                        <td class="ppi-view-text">{{ item.definition }}</td>
                        <td class="ppi-view-text">{{ item.formula }}</td>
                    </tr>
                </tbody>
            </v-table>
            <div v-else class="ppi-empty">{{ $t('ppi.empty') || '등록된 지표가 없습니다.' }}</div>
        </template>

        <!-- 편집(입력) 뷰: 지표별 입력 카드 -->
        <template v-else>
            <v-card v-for="(item, index) in local" :key="index" variant="outlined" class="pa-3 mb-3">
                <div class="d-flex align-start">
                    <div class="flex-grow-1">
                        <v-row dense>
                            <v-col cols="12" sm="6">
                                <v-text-field
                                    v-model="item.name"
                                    :label="$t('ppi.name') || '지표명'"
                                    density="compact"
                                    variant="outlined"
                                    hide-details
                                    @update:model-value="emitChange"
                                />
                            </v-col>
                            <v-col cols="6" sm="3">
                                <v-text-field
                                    v-model="item.unit"
                                    :label="$t('ppi.unit') || '단위'"
                                    placeholder="%"
                                    density="compact"
                                    variant="outlined"
                                    hide-details
                                    @update:model-value="emitChange"
                                />
                            </v-col>
                            <v-col cols="6" sm="3">
                                <v-text-field
                                    v-model="item.cycle"
                                    :label="$t('ppi.cycle') || '측정주기'"
                                    placeholder="1회/반기"
                                    density="compact"
                                    variant="outlined"
                                    hide-details
                                    @update:model-value="emitChange"
                                />
                            </v-col>
                            <v-col cols="12">
                                <v-textarea
                                    v-model="item.definition"
                                    :label="$t('ppi.definition') || '운영정의'"
                                    rows="2"
                                    auto-grow
                                    density="compact"
                                    variant="outlined"
                                    hide-details
                                    @update:model-value="emitChange"
                                />
                            </v-col>
                            <v-col cols="12">
                                <v-textarea
                                    v-model="item.formula"
                                    :label="$t('ppi.formula') || '산출식'"
                                    rows="2"
                                    auto-grow
                                    density="compact"
                                    variant="outlined"
                                    hide-details
                                    @update:model-value="emitChange"
                                />
                            </v-col>
                        </v-row>
                    </div>
                    <v-btn icon variant="text" size="small" class="ml-2" @click="removeItem(index)">
                        <v-icon size="18">mdi-delete-outline</v-icon>
                    </v-btn>
                </div>
            </v-card>
            <v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-plus" @click="addItem">
                {{ $t('ppi.addItem') || '지표 추가' }}
            </v-btn>
        </template>
    </div>
</template>

<script>
export default {
    name: 'ppi-field',
    props: {
        // [{name, unit, cycle, definition, formula}] 또는 null
        modelValue: Array,
        readonly: Boolean
    },
    emits: ['update:modelValue'],
    data() {
        return {
            local: this.normalize(this.modelValue),
            syncing: false
        };
    },
    watch: {
        modelValue: {
            deep: true,
            handler(newVal) {
                if (this.syncing) return;
                this.local = this.normalize(newVal);
            }
        }
    },
    methods: {
        normalize(value) {
            if (!Array.isArray(value)) return [];
            return value.map((item) => ({
                name: item?.name || '',
                unit: item?.unit || '',
                cycle: item?.cycle || '',
                definition: item?.definition || '',
                formula: item?.formula || ''
            }));
        },
        addItem() {
            this.local.push({ name: '', unit: '', cycle: '', definition: '', formula: '' });
        },
        removeItem(index) {
            this.local.splice(index, 1);
            this.emitChange();
        },
        emitChange() {
            const cleaned = this.local.filter((item) =>
                [item.name, item.unit, item.cycle, item.definition, item.formula].some((v) => (v || '').toString().trim())
            );
            this.syncing = true;
            // 전부 비어 있으면 null을 내보내 프로세스 JSON에 빈 ppi가 저장되지 않게 한다.
            this.$emit('update:modelValue', cleaned.length > 0 ? cleaned : null);
            this.$nextTick(() => {
                this.syncing = false;
            });
        }
    }
};
</script>

<style scoped>
.ppi-hint {
    font-size: 11px;
    color: var(--cds-text-secondary, rgba(0, 0, 0, 0.6));
    white-space: nowrap;
}

.ppi-view-table th {
    white-space: nowrap;
    font-size: 12px;
}

.ppi-view-text {
    font-size: 12px;
    white-space: pre-line;
}

.ppi-empty {
    padding: 12px;
    font-size: 12px;
    color: var(--cds-text-secondary, rgba(0, 0, 0, 0.6));
    border: 1px dashed var(--cds-border-subtle, rgba(0, 0, 0, 0.12));
    border-radius: 8px;
}
</style>

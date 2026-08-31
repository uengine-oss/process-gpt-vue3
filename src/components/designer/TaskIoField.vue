<template>
    <div class="task-io-field">
        <!-- ReadOnly(조회) 뷰: 문서형 카드로 표시 -->
        <template v-if="readonly">
            <div v-for="section in sections" :key="section.key" class="io-view-section mb-4">
                <div class="io-view-header" :class="`io-view-header--${section.key}`">
                    <v-icon size="16" class="mr-1">{{ section.icon }}</v-icon>
                    {{ section.label }}
                </div>
                <ul v-if="local[section.key].length > 0" class="io-view-list">
                    <li v-for="(item, index) in local[section.key]" :key="index" class="io-view-item">
                        <span v-if="section.ordered" class="io-view-step mr-2">{{ index + 1 }}</span>
                        <v-icon v-else size="14" class="mr-1 io-view-item-icon">mdi-file-document-outline</v-icon>
                        <span>{{ item }}</span>
                    </li>
                </ul>
                <div v-else class="io-view-empty">{{ $t('taskIo.empty') || '등록된 항목이 없습니다.' }}</div>
            </div>
        </template>

        <!-- 편집(입력) 뷰: 항목별 입력창 + 추가/삭제 -->
        <template v-else>
            <div v-for="section in sections" :key="section.key" class="mb-5">
                <div class="d-flex align-center mb-2">
                    <h6 class="text-body-1">
                        <v-icon size="16" class="mr-1">{{ section.icon }}</v-icon>
                        {{ section.label }}
                    </h6>
                    <v-spacer />
                    <span class="io-edit-hint">{{ section.hint }}</span>
                </div>
                <div v-for="(item, index) in local[section.key]" :key="index" class="d-flex align-center mb-2">
                    <span v-if="section.ordered" class="io-view-step mr-2">{{ index + 1 }}</span>
                    <v-text-field
                        :model-value="item"
                        density="compact"
                        variant="outlined"
                        hide-details
                        :placeholder="section.placeholder"
                        @update:model-value="(val) => updateItem(section.key, index, val)"
                    />
                    <v-btn icon variant="text" size="small" class="ml-1" @click="removeItem(section.key, index)">
                        <v-icon size="18">mdi-delete-outline</v-icon>
                    </v-btn>
                </div>
                <v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-plus" @click="addItem(section.key)">
                    {{ $t('taskIo.addItem') || '항목 추가' }}
                </v-btn>
            </div>
        </template>
    </div>
</template>

<script>
export default {
    name: 'task-io-field',
    props: {
        // 세부 업무 수행 절차의 단계 목록 — 순서가 의미를 가진다 (string[] 또는 null)
        procedure: Array,
        readonly: Boolean
    },
    emits: ['update:procedure'],
    data() {
        return {
            local: {
                procedure: this.normalize(this.procedure)
            },
            syncing: false
        };
    },
    computed: {
        sections() {
            return [
                {
                    key: 'procedure',
                    icon: 'mdi-format-list-numbered',
                    ordered: true,
                    label: this.$t('taskIo.procedure') || '업무 수행 절차',
                    hint: this.$t('taskIo.procedureHint') || '이 업무를 수행하는 단계별 절차',
                    placeholder: this.$t('taskIo.procedurePlaceholder') || '예: 내부심사 체크리스트를 기준으로 심사 수행'
                }
            ];
        }
    },
    watch: {
        procedure: {
            deep: true,
            handler(newVal) {
                if (this.syncing) return;
                this.local.procedure = this.normalize(newVal);
            }
        }
    },
    methods: {
        normalize(value) {
            if (Array.isArray(value)) return value.map((v) => (v == null ? '' : v.toString()));
            if (typeof value === 'string' && value) return [value];
            return [];
        },
        addItem(key) {
            this.local[key].push('');
        },
        removeItem(key, index) {
            this.local[key].splice(index, 1);
            this.emitChange(key);
        },
        updateItem(key, index, value) {
            this.local[key][index] = value;
            this.emitChange(key);
        },
        emitChange(key) {
            if (key !== 'procedure') return;
            const cleaned = this.local[key].map((v) => (v || '').toString().trim()).filter(Boolean);
            this.syncing = true;
            // 전부 비어 있으면 null을 내보내 태스크 JSON에 빈 배열이 저장되지 않게 한다. (RaciField와 동일 규칙)
            this.$emit(`update:${key}`, cleaned.length > 0 ? cleaned : null);
            this.$nextTick(() => {
                this.syncing = false;
            });
        }
    }
};
</script>

<style scoped>
.io-edit-hint {
    font-size: 11px;
    color: var(--cds-text-secondary, rgba(0, 0, 0, 0.6));
    white-space: nowrap;
}

/* ReadOnly 문서형 뷰 */
.io-view-section {
    border: 1px solid var(--cds-border-subtle, rgba(0, 0, 0, 0.12));
    border-radius: 8px;
    overflow: hidden;
}

.io-view-header {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 600;
}

.io-view-header--procedure {
    background: var(--cds-layer-accent, rgba(103, 58, 183, 0.08));
    color: var(--cds-support-info, #5e35b1);
}

.io-view-step {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--cds-layer-accent, rgba(103, 58, 183, 0.12));
    color: var(--cds-support-info, #5e35b1);
    font-size: 11px;
    font-weight: 600;
}

.io-view-list {
    list-style: none;
    margin: 0;
    padding: 8px 12px;
}

.io-view-item {
    display: flex;
    align-items: center;
    padding: 4px 0;
    font-size: 13px;
}

.io-view-item-icon {
    color: var(--cds-icon-secondary, rgba(0, 0, 0, 0.54));
}

.io-view-empty {
    padding: 12px;
    font-size: 12px;
    color: var(--cds-text-secondary, rgba(0, 0, 0, 0.6));
}
</style>

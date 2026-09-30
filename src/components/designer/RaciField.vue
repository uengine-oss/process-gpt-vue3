<template>
    <div class="raci-field">
        <!-- 다이얼로그 입력 모드 (PAL 속성패널): 패널엔 요약만 표시하고 입력은 다이얼로그에서 -->
        <template v-if="dialogMode">
            <template v-if="hasEntries">
                <template v-for="row in rows" :key="row.key">
                    <div v-if="(local[row.key] || []).length > 0" class="raci-summary-row">
                        <span class="raci-summary-key">{{ row.key }}</span>
                        <span class="raci-summary-names">{{ (local[row.key] || []).join(', ') }}</span>
                    </div>
                </template>
            </template>
            <div v-else class="raci-empty">{{ $t('raci.empty') || '지정된 담당이 없습니다.' }}</div>
            <v-btn
                v-if="!readonly"
                size="small"
                variant="tonal"
                color="primary"
                class="mt-2"
                :prepend-icon="hasEntries ? 'mdi-pencil' : 'mdi-plus'"
                @click="openDialog"
            >
                {{ $t('raci.edit') || 'RACI 편집' }}
            </v-btn>

            <v-dialog v-model="dialogOpen" max-width="720" scrollable>
                <v-card>
                    <v-card-title class="d-flex align-center">
                        <v-icon size="20" color="deep-purple" class="mr-2">mdi-table-account</v-icon>
                        <span>{{ $t('raci.title') || 'RACI 차트' }}</span>
                    </v-card-title>
                    <v-card-subtitle class="pb-2">{{
                        $t('raci.legend') || 'R=책임(수행) · A=승인 · S=지원 · C=자문 · I=통보'
                    }}</v-card-subtitle>
                    <v-card-text>
                        <v-combobox
                            v-for="row in rows"
                            :key="row.key"
                            v-model="draft[row.key]"
                            :items="suggestions"
                            :label="row.label"
                            closable-chips
                            multiple
                            chips
                            density="compact"
                            variant="outlined"
                            hide-details
                            class="mb-3"
                        />
                    </v-card-text>
                    <v-card-actions>
                        <v-spacer />
                        <v-btn variant="text" @click="dialogOpen = false">{{ $t('raci.cancel') || '취소' }}</v-btn>
                        <v-btn color="primary" variant="flat" @click="applyDialog">{{ $t('raci.save') || '저장' }}</v-btn>
                    </v-card-actions>
                </v-card>
            </v-dialog>
        </template>

        <!-- 인라인 편집 (기존 — 비 PAL 패널 등 기존 경로) -->
        <template v-else>
            <div class="d-flex align-center mb-2">
                <h6 class="text-body-1">{{ $t('raci.title') || 'RACI 차트' }}</h6>
                <v-spacer />
                <span class="raci-legend">{{ $t('raci.legend') || 'R=책임(수행) · A=승인 · S=지원 · C=자문 · I=통보' }}</span>
            </div>
            <v-combobox
                v-for="row in rows"
                :key="row.key"
                v-model="local[row.key]"
                :items="suggestions"
                :label="row.label"
                :readonly="readonly"
                :closable-chips="!readonly"
                multiple
                chips
                density="compact"
                variant="outlined"
                hide-details
                class="mb-2"
            />
        </template>
    </div>
</template>

<script>
const RACI_KEYS = ['R', 'A', 'S', 'C', 'I'];

export default {
    name: 'raci-field',
    props: {
        // true면 패널에 요약만 보여주고 입력은 다이얼로그에서 받는다 (좁은 속성패널용).
        // 기본 false — 기존 인라인 편집 경로 유지.
        dialogMode: { type: Boolean, default: false },
        // {R:[], A:[], S:[], C:[], I:[]} 또는 null
        modelValue: Object,
        readonly: Boolean,
        // Task가 올라가 있는 Lane 이름 — R(책임)이 비어 있으면 편집 시작 시 자동 입력된다
        laneName: { type: String, default: '' },
        // 조직/역할 이름 제안 목록 (레인 이름 + 이미 사용된 조직명)
        suggestions: {
            type: Array,
            default: () => []
        }
    },
    emits: ['update:modelValue'],
    data() {
        return {
            local: this.normalize(this.modelValue),
            syncing: false,
            dialogOpen: false,
            draft: { R: [], A: [], S: [], C: [], I: [] }
        };
    },
    computed: {
        hasEntries() {
            return RACI_KEYS.some((key) => (this.local[key] || []).length > 0);
        },
        rows() {
            return [
                { key: 'R', label: this.$t('raci.responsible') || 'R · 책임(수행)' },
                { key: 'A', label: this.$t('raci.accountable') || 'A · 승인' },
                { key: 'S', label: this.$t('raci.support') || 'S · 지원' },
                { key: 'C', label: this.$t('raci.consulted') || 'C · 자문' },
                { key: 'I', label: this.$t('raci.informed') || 'I · 통보' }
            ];
        }
    },
    watch: {
        modelValue: {
            deep: true,
            handler(newVal) {
                if (this.syncing) return;
                this.local = this.normalize(newVal);
            }
        },
        local: {
            deep: true,
            handler() {
                const cleaned = {};
                let empty = true;
                RACI_KEYS.forEach((key) => {
                    const arr = (this.local[key] || []).map((v) => (v || '').toString().trim()).filter(Boolean);
                    cleaned[key] = arr;
                    if (arr.length > 0) empty = false;
                });
                this.syncing = true;
                // 전부 비어 있으면 null을 내보내 태스크 JSON에 빈 raci가 저장되지 않게 한다.
                this.$emit('update:modelValue', empty ? null : cleaned);
                this.$nextTick(() => {
                    this.syncing = false;
                });
            }
        }
    },
    methods: {
        openDialog() {
            // 다이얼로그는 초안(draft)을 편집하고 저장을 눌러야만 모델에 반영한다.
            this.draft = this.normalize(this.local);
            // R(책임)이 비어 있으면 Task가 속한 Lane 이름을 기본값으로 채운다 — 저장 전이라 수정/삭제 가능.
            const lane = (this.laneName || '').trim();
            if (lane && this.draft.R.length === 0) this.draft.R = [lane];
            this.dialogOpen = true;
        },
        applyDialog() {
            // local 교체가 deep 워처를 태워 정리된 값(전부 비면 null)을 emit 한다.
            this.local = this.normalize(this.draft);
            this.dialogOpen = false;
        },
        normalize(value) {
            const out = { R: [], A: [], S: [], C: [], I: [] };
            if (value && typeof value === 'object') {
                RACI_KEYS.forEach((key) => {
                    if (Array.isArray(value[key])) out[key] = [...value[key]];
                    else if (typeof value[key] === 'string' && value[key]) out[key] = [value[key]];
                });
            }
            return out;
        }
    }
};
</script>

<style scoped>
.raci-legend {
    font-size: 11px;
    color: var(--cds-text-secondary, rgba(0, 0, 0, 0.6));
    white-space: nowrap;
}

/* 다이얼로그 모드 요약 뷰 */
.raci-summary-row {
    display: flex;
    align-items: flex-start;
    font-size: 13px;
    padding: 2px 0;
}

.raci-summary-key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    margin-right: 8px;
    border-radius: 50%;
    background: var(--cds-layer-accent, rgba(103, 58, 183, 0.12));
    color: var(--cds-support-info, #5e35b1);
    font-size: 11px;
    font-weight: 600;
}

.raci-summary-names {
    line-height: 20px;
    word-break: break-all;
}

.raci-empty {
    padding: 12px;
    font-size: 12px;
    color: var(--cds-text-secondary, rgba(0, 0, 0, 0.6));
    border: 1px dashed var(--cds-border-subtle, rgba(0, 0, 0, 0.12));
    border-radius: 8px;
}
</style>

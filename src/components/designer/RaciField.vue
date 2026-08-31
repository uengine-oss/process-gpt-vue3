<template>
    <div class="raci-field">
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
    </div>
</template>

<script>
const RACI_KEYS = ['R', 'A', 'S', 'C', 'I'];

export default {
    name: 'raci-field',
    props: {
        // {R:[], A:[], S:[], C:[], I:[]} 또는 null
        modelValue: Object,
        readonly: Boolean,
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
            syncing: false
        };
    },
    computed: {
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
</style>

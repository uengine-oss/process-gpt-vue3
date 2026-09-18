<template>
    <div class="kbd">
        <div class="kbd__bar">
            <v-text-field
                v-model="search"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                prepend-inner-icon="mdi-magnify"
                :placeholder="overflow ? '문서가 많아 질문으로 추립니다 — 찾는 내용을 적고 Enter' : '제목·파일명·구별 사실로 찾기'"
                class="kbd__search"
                @keyup.enter="overflow ? $emit('query', search) : null"
            />
            <v-btn-toggle v-model="stateFilter" density="compact" variant="outlined" divided class="kbd__filter">
                <v-btn value="" size="small">전체 {{ docs.length }}</v-btn>
                <v-btn v-for="(c, k) in stateCounts" :key="k" :value="k" size="small" :color="DOC_STATES[k].color">
                    {{ DOC_STATES[k].label }} {{ c }}
                </v-btn>
            </v-btn-toggle>
        </div>

        <div v-if="overflow && !docs.length" class="kbd__empty">
            이 폴더에는 문서가 <strong>{{ nDirect }}</strong>건 있어 한 번에 나열하지 않습니다. 위에 찾는 내용을 적으면 관련 문서부터 보여 줍니다.
        </div>
        <div v-else-if="loading" class="kbd__empty"><v-progress-circular indeterminate size="18" width="2" class="mr-2" /> 불러오는 중…</div>
        <div v-else-if="!filtered.length" class="kbd__empty">{{ docs.length ? '조건에 맞는 문서가 없습니다.' : '이 폴더에 직접 든 문서가 없습니다.' }}</div>

        <div v-else class="kbd__rows">
            <button v-for="d in paged" :key="d.source_ref || d.path" type="button" class="kbd__row" @click="$emit('open', d)">
                <v-icon size="20" :color="iconOf(d.file_name).color" class="kbd__icon">{{ iconOf(d.file_name).icon }}</v-icon>
                <div class="kbd__main">
                    <div class="kbd__title-line">
                        <span class="kbd__title">{{ titleOf(d) }}</span>
                        <span v-if="d.card && d.card.doc_type" class="kbd__type">{{ d.card.doc_type }}</span>
                    </div>
                    <div v-if="titleOf(d) !== d.file_name" class="kbd__file">{{ d.file_name }}</div>
                    <div v-if="d.card && d.card.distinguishers && d.card.distinguishers.length" class="kbd__dist">
                        <span v-for="x in d.card.distinguishers.slice(0, 4)" :key="x" class="kbd__dist-chip">{{ x }}</span>
                    </div>
                    <div v-else-if="d.card && d.card.summary" class="kbd__summary">{{ d.card.summary }}</div>
                </div>
                <div class="kbd__meta">
                    <span class="kbd__state" :class="`is-${stateOf(d)}`">
                        <v-icon size="13">{{ DOC_STATES[stateOf(d)].icon }}</v-icon>
                        {{ stateLabel(d) }}
                    </span>
                    <span v-if="isHintless(d)" class="kbd__hint" title="의미 검색 힌트를 만들지 못했습니다. 지도(카드·본문)로는 찾을 수 있습니다.">
                        <v-icon size="13">mdi-magnify-close</v-icon>
                    </span>
                    <span class="kbd__sub">{{ formatBytes(d.size_bytes) }}<template v-if="d.n_pages"> · {{ d.n_pages }}p</template></span>
                    <span v-if="d.uploaded_by_name" class="kbd__sub">{{ d.uploaded_by_name }}</span>
                </div>
            </button>
        </div>

        <div v-if="filtered.length > pageSize" class="kbd__pager">
            <v-pagination v-model="page" :length="Math.ceil(filtered.length / pageSize)" density="compact" total-visible="7" />
        </div>
    </div>
</template>

<script>
import { DOC_STATES, INDEX_STATES, CARDLESS_ROLES } from './kbRoles';
import { iconOf, formatBytes } from './kbFormat';

export default {
    name: 'KbDocList',
    props: {
        docs: { type: Array, default: () => [] },
        loading: { type: Boolean, default: false },
        overflow: { type: Boolean, default: false },
        nDirect: { type: Number, default: 0 }
    },
    emits: ['open', 'query'],
    data() {
        return { search: '', stateFilter: '', page: 1, pageSize: 50, DOC_STATES };
    },
    computed: {
        stateCounts() {
            const out = {};
            for (const d of this.docs) {
                const s = this.stateOf(d);
                out[s] = (out[s] || 0) + 1;
            }
            return out;
        },
        filtered() {
            const q = (this.search || '').trim().toLowerCase();
            return this.docs.filter((d) => {
                if (this.stateFilter && this.stateOf(d) !== this.stateFilter) return false;
                if (!q || this.overflow) return true;
                const hay = [d.file_name, d.card?.title, d.card?.summary, ...(d.card?.distinguishers || []), ...(d.card?.topics || [])]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                return hay.includes(q);
            });
        },
        paged() {
            const start = (this.page - 1) * this.pageSize;
            return this.filtered.slice(start, start + this.pageSize);
        }
    },
    watch: {
        docs() {
            this.page = 1;
        },
        search() {
            this.page = 1;
        },
        stateFilter() {
            this.page = 1;
        }
    },
    methods: {
        iconOf,
        formatBytes,
        titleOf(d) {
            return (d.card && d.card.title) || d.file_name || '';
        },
        // 카드를 만들지 않는 분류(용어사전·양식·데이터)는 인제스트가 끝나면 곧 읽을 수 있음이다.
        stateOf(d) {
            if (CARDLESS_ROLES.has(d.doc_role)) {
                if (d.index_status === 'failed') return 'failed';
                return d.index_status === 'indexed' ? 'ready' : 'pending';
            }
            if (d.index_status === 'pending' || d.index_status === 'processing') return 'pending';
            if (d.index_status === 'failed') return 'failed';
            return (d.card && d.card.state) || 'pending';
        },
        stateLabel(d) {
            if (d.index_status && d.index_status !== 'indexed' && INDEX_STATES[d.index_status]) {
                return d.index_status === 'failed' ? '처리 실패' : INDEX_STATES[d.index_status].label;
            }
            return DOC_STATES[this.stateOf(d)].label;
        },
        isHintless(d) {
            return typeof d.index_error === 'string' && d.index_error.startsWith('hints:');
        }
    }
};
</script>

<style scoped>
.kbd__bar {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 8px;
}
.kbd__search {
    flex: 1;
    min-width: 240px;
}
.kbd__filter :deep(.v-btn) {
    text-transform: none;
    letter-spacing: 0;
    font-size: 12px;
}
.kbd__empty {
    padding: 28px 12px;
    text-align: center;
    color: var(--cds-text-muted);
    font-size: 13px;
    border: 1px dashed var(--cds-border);
    border-radius: var(--cds-radius, 8px);
}
.kbd__rows {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--cds-border);
    border-radius: var(--cds-radius, 8px);
    overflow: hidden;
}
.kbd__row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    background: transparent;
    border: 0;
    border-bottom: 1px solid var(--cds-border);
    text-align: left;
    font: inherit;
    cursor: pointer;
    width: 100%;
}
.kbd__row:last-child {
    border-bottom: 0;
}
.kbd__row:hover {
    background: var(--cds-bg-neutral);
}
.kbd__icon {
    margin-top: 2px;
    flex: 0 0 auto;
}
.kbd__main {
    flex: 1;
    min-width: 0;
}
.kbd__title-line {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
}
.kbd__title {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--cds-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.kbd__type {
    flex: 0 0 auto;
    font-size: 11px;
    color: var(--cds-text-secondary);
    background: var(--cds-bg-neutral);
    border-radius: 4px;
    padding: 0 6px;
}
.kbd__file {
    font-size: 11.5px;
    color: var(--cds-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.kbd__dist {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
}
.kbd__dist-chip {
    font-size: 11px;
    padding: 1px 7px;
    border-radius: 10px;
    background: rgba(var(--v-theme-primary), 0.08);
    color: rgb(var(--v-theme-primary));
}
.kbd__summary {
    margin-top: 3px;
    font-size: 12px;
    color: var(--cds-text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.kbd__meta {
    flex: 0 0 150px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    font-size: 11.5px;
    color: var(--cds-text-muted);
}
.kbd__state {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    font-weight: 500;
    padding: 1px 8px;
    border-radius: 10px;
}
.kbd__state.is-ready {
    color: var(--cds-text-success);
    background: rgba(76, 175, 80, 0.12);
}
.kbd__state.is-pending {
    color: var(--cds-text-secondary);
    background: var(--cds-bg-neutral);
}
.kbd__state.is-failed {
    color: var(--cds-text-danger);
    background: rgba(244, 67, 54, 0.1);
}
.kbd__state.is-no_text {
    color: var(--cds-text-warning);
    background: rgba(255, 152, 0, 0.12);
}
.kbd__hint {
    color: var(--cds-text-warning);
}
.kbd__pager {
    margin-top: 8px;
}
@media (max-width: 720px) {
    .kbd__meta {
        display: none;
    }
}
</style>

<template>
    <v-navigation-drawer :model-value="!!doc" location="right" temporary width="560" class="kdd" @update:model-value="(v) => !v && $emit('close')">
        <template v-if="doc">
            <div class="kdd__head">
                <v-icon size="22" :color="iconOf(doc.file_name).color">{{ iconOf(doc.file_name).icon }}</v-icon>
                <div class="kdd__head-text">
                    <div class="kdd__title">{{ card.title || doc.file_name }}</div>
                    <div v-if="card.title && card.title !== doc.file_name" class="kdd__file">{{ doc.file_name }}</div>
                </div>
                <v-btn icon variant="text" size="small" @click="$emit('close')"><v-icon>mdi-close</v-icon></v-btn>
            </div>

            <div class="kdd__body">
                <div class="kdd__chips">
                    <v-chip size="small" :color="stateMeta.color" variant="tonal">
                        <v-icon start size="14">{{ stateMeta.icon }}</v-icon>{{ stateMeta.label }}
                    </v-chip>
                    <v-chip v-if="card.doc_type" size="small" variant="outlined">{{ card.doc_type }}</v-chip>
                    <v-chip size="small" variant="outlined" :color="role.color">
                        <v-icon start size="13">{{ role.icon }}</v-icon>{{ role.label }}
                    </v-chip>
                    <v-chip v-if="doc.index_status && doc.index_status !== 'indexed'" size="small" :color="indexMeta.color" variant="tonal">
                        처리 {{ indexMeta.label }}
                    </v-chip>
                </div>

                <v-alert v-if="doc.index_error && !isHintError" type="error" variant="tonal" density="compact" class="mt-3 text-body-2">
                    {{ doc.index_error }}
                </v-alert>
                <v-alert v-else-if="isHintError" type="warning" variant="tonal" density="compact" class="mt-3 text-body-2">
                    의미 검색 힌트를 만들지 못했습니다. 카드와 본문으로는 찾을 수 있습니다.
                    <div class="text-caption mt-1">{{ doc.index_error.slice(7) }}</div>
                </v-alert>

                <template v-if="hasCard">
                    <section class="kdd__sec">
                        <h4>요약</h4>
                        <p>{{ card.summary }}</p>
                    </section>
                    <section v-if="card.distinguishers && card.distinguishers.length" class="kdd__sec">
                        <h4>이 문서만의 사실</h4>
                        <div class="kdd__tags"><span v-for="x in card.distinguishers" :key="x" class="kdd__tag kdd__tag--accent">{{ x }}</span></div>
                    </section>
                    <section v-if="card.answers_questions && card.answers_questions.length" class="kdd__sec">
                        <h4>이 문서가 답하는 질문</h4>
                        <ul class="kdd__list"><li v-for="q in card.answers_questions" :key="q">{{ q }}</li></ul>
                    </section>
                    <section v-if="card.topics && card.topics.length" class="kdd__sec">
                        <h4>주제</h4>
                        <div class="kdd__tags"><span v-for="x in card.topics" :key="x" class="kdd__tag">{{ x }}</span></div>
                    </section>
                    <section v-if="card.coverage" class="kdd__sec kdd__sec--muted">
                        카드 근거: {{ card.coverage.whole_document ? '문서 전체를 읽음' : `문서의 ${coveragePct}% 를 읽음` }}
                        <template v-if="card.coverage.windows_failed"> · 조각 {{ card.coverage.windows_failed }}개 실패</template>
                    </section>
                </template>
                <section v-else-if="cardless" class="kdd__sec kdd__sec--muted">
                    이 분류는 문서 카드를 만들지 않습니다. 에이전트는 본문을 직접 읽습니다.
                </section>
                <section v-else-if="state === 'pending'" class="kdd__sec kdd__sec--muted">
                    <v-progress-circular indeterminate size="14" width="2" class="mr-2" />문서 카드를 만드는 중입니다. 본문은 이미 읽을 수 있습니다.
                </section>
                <section v-else-if="state === 'no_text'" class="kdd__sec kdd__sec--muted">
                    텍스트 레이어가 없어 읽을 수 없는 문서입니다(스캔본 등). 에이전트에게는 "자료에 없음"이 아니라 "읽을 수 없음"으로 보입니다.
                </section>
                <section v-else-if="state === 'failed'" class="kdd__sec kdd__sec--muted">
                    문서 카드 생성에 실패했습니다. 본문이 저장돼 있으면 카드만 다시 만들 수 있습니다.
                </section>

                <section class="kdd__sec kdd__meta">
                    <div><span>크기</span><b>{{ formatBytes(doc.size_bytes) }}</b></div>
                    <div v-if="doc.n_pages"><span>페이지</span><b>{{ doc.n_pages }}</b></div>
                    <div><span>올린 사람</span><b>{{ doc.uploaded_by_name || '-' }}</b></div>
                    <div><span>올린 시각</span><b>{{ formatDate(doc.modified_time) }}</b></div>
                    <div><span>경로</span><b class="kdd__path">{{ doc.path }}</b></div>
                </section>
            </div>

            <div class="kdd__actions">
                <v-btn size="small" variant="tonal" prepend-icon="mdi-download-outline" :loading="busy.download" @click="download">원문</v-btn>
                <v-btn size="small" variant="tonal" prepend-icon="mdi-file-search-outline" :disabled="!canPreview" :loading="busy.preview" @click="preview">저장된 본문</v-btn>
                <v-btn v-if="canManage && !cardless" size="small" variant="tonal" color="primary" prepend-icon="mdi-card-text-outline" :loading="busy.card" @click="rebuild">카드 다시 만들기</v-btn>
                <v-btn v-if="canManage" size="small" variant="text" prepend-icon="mdi-refresh" :loading="busy.reindex" @click="reindex">전체 재처리</v-btn>
                <v-spacer />
                <v-btn v-if="canManage" size="small" variant="text" color="error" prepend-icon="mdi-delete-outline" @click="$emit('delete', doc)">삭제</v-btn>
                <v-tooltip v-else text="본인이 올린 파일만 관리할 수 있습니다" location="top">
                    <template v-slot:activator="{ props }"><v-icon v-bind="props" size="16" color="grey">mdi-lock-outline</v-icon></template>
                </v-tooltip>
            </div>
        </template>

        <v-dialog v-model="previewDialog" max-width="1100" scrollable>
            <v-card>
                <v-card-title class="d-flex align-center text-subtitle-1">
                    저장된 본문 — 에이전트가 읽는 그대로
                    <v-spacer />
                    <v-btn icon variant="text" size="small" @click="previewDialog = false"><v-icon>mdi-close</v-icon></v-btn>
                </v-card-title>
                <v-divider />
                <v-card-text style="height: 70vh">
                    <ParsedPagesView :pages="pages" :file-name="doc ? doc.file_name : ''" :loading="busy.preview" :error="previewError" />
                </v-card-text>
            </v-card>
        </v-dialog>
    </v-navigation-drawer>
</template>

<script>
import ParsedPagesView from '@/components/knowledge/ParsedPagesView.vue';
import { DOC_STATES, INDEX_STATES, CARDLESS_ROLES, roleMeta } from './kbRoles';
import { iconOf, formatBytes, formatDate } from './kbFormat';
import { fileUrl, storedPages, rebuildCard, reindexFile, errorText } from './kbApi';

export default {
    name: 'KbDocDrawer',
    components: { ParsedPagesView },
    props: {
        doc: { type: Object, default: null },
        canManage: { type: Boolean, default: false }
    },
    emits: ['close', 'delete', 'changed', 'notify'],
    data() {
        return {
            busy: { download: false, preview: false, card: false, reindex: false },
            previewDialog: false,
            previewError: '',
            pages: []
        };
    },
    computed: {
        card() {
            return (this.doc && this.doc.card) || {};
        },
        role() {
            return roleMeta(this.doc?.doc_role);
        },
        cardless() {
            return CARDLESS_ROLES.has(this.doc?.doc_role);
        },
        state() {
            const d = this.doc || {};
            if (d.index_status === 'pending' || d.index_status === 'processing') return 'pending';
            if (d.index_status === 'failed') return 'failed';
            if (this.cardless) return d.index_status === 'indexed' ? 'ready' : 'pending';
            return this.card.state || 'pending';
        },
        stateMeta() {
            return DOC_STATES[this.state] || DOC_STATES.pending;
        },
        indexMeta() {
            return INDEX_STATES[this.doc?.index_status] || INDEX_STATES.pending;
        },
        hasCard() {
            return !!(this.card && this.card.summary);
        },
        isHintError() {
            return typeof this.doc?.index_error === 'string' && this.doc.index_error.startsWith('hints:');
        },
        coveragePct() {
            const c = this.card.coverage || {};
            return c.chars_total ? Math.round(((c.chars_read || 0) / c.chars_total) * 100) : 0;
        },
        canPreview() {
            return this.doc && this.doc.has_text !== false && this.doc.index_status === 'indexed';
        }
    },
    watch: {
        doc() {
            this.pages = [];
            this.previewError = '';
        }
    },
    methods: {
        iconOf,
        formatBytes,
        formatDate,
        async download() {
            this.busy.download = true;
            try {
                const url = await fileUrl(this.doc);
                if (url) window.open(url, '_blank', 'noopener');
                else this.$emit('notify', { text: '다운로드 URL을 가져오지 못했습니다', color: 'error' });
            } catch (e) {
                this.$emit('notify', { text: errorText(e, '다운로드 실패'), color: 'error' });
            } finally {
                this.busy.download = false;
            }
        },
        async preview() {
            this.previewDialog = true;
            this.busy.preview = true;
            this.previewError = '';
            try {
                this.pages = await storedPages(this.doc);
                if (!this.pages.length) this.previewError = '저장된 본문이 없습니다.';
            } catch (e) {
                this.previewError = errorText(e, '본문을 불러오지 못했습니다');
            } finally {
                this.busy.preview = false;
            }
        },
        async rebuild() {
            this.busy.card = true;
            try {
                const res = await rebuildCard(this.doc);
                this.$emit('notify', {
                    text: res?.summarized ? '문서 카드를 다시 만들었습니다' : `카드 생성 결과: ${res?.card_status || '실패'}`,
                    color: res?.summarized ? 'success' : 'warning'
                });
                this.$emit('changed');
            } catch (e) {
                this.$emit('notify', { text: errorText(e, '카드 재생성 실패'), color: 'error' });
            } finally {
                this.busy.card = false;
            }
        },
        async reindex() {
            this.busy.reindex = true;
            try {
                await reindexFile(this.doc);
                this.$emit('notify', { text: '재처리를 접수했습니다. 상태가 갱신될 때까지 잠시 걸립니다.', color: 'success' });
                this.$emit('changed');
            } catch (e) {
                this.$emit('notify', { text: errorText(e, '재처리 실패'), color: 'error' });
            } finally {
                this.busy.reindex = false;
            }
        }
    }
};
</script>

<style scoped>
.kdd :deep(.v-navigation-drawer__content) {
    display: flex;
    flex-direction: column;
}
.kdd__head {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 14px 12px 10px 16px;
    border-bottom: 1px solid var(--cds-border);
}
.kdd__head-text {
    flex: 1;
    min-width: 0;
}
.kdd__title {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.35;
    word-break: break-word;
}
.kdd__file {
    font-size: 12px;
    color: var(--cds-text-muted);
    word-break: break-all;
}
.kdd__body {
    flex: 1;
    overflow: auto;
    padding: 12px 16px 16px;
}
.kdd__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.kdd__sec {
    margin-top: 16px;
}
.kdd__sec h4 {
    font-size: 12px;
    font-weight: 600;
    color: var(--cds-text-secondary);
    margin: 0 0 6px;
}
.kdd__sec p {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--cds-text-primary);
    white-space: pre-line;
}
.kdd__sec--muted {
    font-size: 12.5px;
    color: var(--cds-text-muted);
    line-height: 1.5;
}
.kdd__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
}
.kdd__tag {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--cds-bg-neutral);
    color: var(--cds-text-secondary);
}
.kdd__tag--accent {
    background: rgba(var(--v-theme-primary), 0.1);
    color: rgb(var(--v-theme-primary));
}
.kdd__list {
    margin: 0;
    padding-left: 18px;
    font-size: 13px;
    line-height: 1.55;
}
.kdd__meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 16px;
    font-size: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--cds-border);
}
.kdd__meta div {
    display: flex;
    flex-direction: column;
    min-width: 0;
}
.kdd__meta span {
    color: var(--cds-text-muted);
}
.kdd__meta b {
    font-weight: 500;
    color: var(--cds-text-primary);
}
.kdd__path {
    word-break: break-all;
    grid-column: 1 / -1;
}
.kdd__actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 12px;
    border-top: 1px solid var(--cds-border);
}
</style>

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
                    <v-chip v-if="doc.index_status && doc.index_status !== 'indexed'" size="small" :color="indexMeta.color" variant="tonal">
                        {{ $t('KbDocDrawer.indexStatus', { label: indexMeta.label }) }}
                    </v-chip>
                </div>

                <v-alert v-if="doc.index_error && !isHintError" type="error" variant="tonal" density="compact" class="mt-3 text-body-2">
                    {{ doc.index_error }}
                </v-alert>
                <v-alert v-else-if="isHintError" type="warning" variant="tonal" density="compact" class="mt-3 text-body-2">
                    {{ $t('KbDocDrawer.hintError') }}
                    <div class="text-caption mt-1">{{ doc.index_error.slice(7) }}</div>
                </v-alert>

                <template v-if="hasCard">
                    <section class="kdd__sec">
                        <h4>{{ $t('KbDocDrawer.summary') }}</h4>
                        <p>{{ card.summary }}</p>
                    </section>
                    <section v-if="card.distinguishers && card.distinguishers.length" class="kdd__sec">
                        <h4>{{ $t('KbDocDrawer.distinguishers') }}</h4>
                        <div class="kdd__tags"><span v-for="x in card.distinguishers" :key="x" class="kdd__tag kdd__tag--accent">{{ x }}</span></div>
                    </section>
                    <section v-if="card.answers_questions && card.answers_questions.length" class="kdd__sec">
                        <h4>{{ $t('KbDocDrawer.answersQuestions') }}</h4>
                        <ul class="kdd__list"><li v-for="q in card.answers_questions" :key="q">{{ q }}</li></ul>
                    </section>
                    <section v-if="card.topics && card.topics.length" class="kdd__sec">
                        <h4>{{ $t('KbDocDrawer.topics') }}</h4>
                        <div class="kdd__tags"><span v-for="x in card.topics" :key="x" class="kdd__tag">{{ x }}</span></div>
                    </section>
                    <section v-if="card.coverage" class="kdd__sec kdd__sec--muted">
                        {{ card.coverage.whole_document ? $t('KbDocDrawer.coverageWhole') : $t('KbDocDrawer.coveragePartial', { pct: coveragePct }) }}
                        <template v-if="card.coverage.windows_failed"> · {{ $t('KbDocDrawer.chunksFailed', { n: Number(card.coverage.windows_failed) }) }}</template>
                    </section>
                </template>
                <section v-else-if="state === 'pending'" class="kdd__sec kdd__sec--muted">
                    <v-progress-circular indeterminate size="14" width="2" class="mr-2" />{{ $t('KbDocDrawer.buildingCard') }}
                </section>
                <section v-else-if="state === 'no_text'" class="kdd__sec kdd__sec--muted">
                    {{ $t('KbDocDrawer.noText') }}
                </section>
                <section v-else-if="state === 'failed'" class="kdd__sec kdd__sec--muted">
                    {{ $t('KbDocDrawer.cardFailed') }}
                </section>

                <section class="kdd__sec kdd__meta">
                    <div><span>{{ $t('KbDocDrawer.size') }}</span><b>{{ formatBytes(doc.size_bytes) }}</b></div>
                    <div v-if="doc.n_pages"><span>{{ $t('KbDocDrawer.pages') }}</span><b>{{ doc.n_pages }}</b></div>
                    <div><span>{{ $t('KbDocDrawer.uploadedBy') }}</span><b>{{ doc.uploaded_by_name || '-' }}</b></div>
                    <div><span>{{ $t('KbDocDrawer.uploadedAt') }}</span><b>{{ formatDate(doc.modified_time) }}</b></div>
                    <div><span>{{ $t('KbDocDrawer.path') }}</span><b class="kdd__path">{{ doc.path }}</b></div>
                </section>
            </div>

            <div class="kdd__actions">
                <v-btn size="small" variant="tonal" prepend-icon="mdi-download-outline" :loading="busy.download" @click="download">{{ $t('KbDocDrawer.original') }}</v-btn>
                <v-btn size="small" variant="tonal" prepend-icon="mdi-file-search-outline" :disabled="!canPreview" :loading="busy.preview" @click="preview">{{ $t('KbDocDrawer.storedText') }}</v-btn>
                <v-btn v-if="canManage" size="small" variant="tonal" color="primary" prepend-icon="mdi-card-text-outline" :loading="busy.card" @click="rebuild">{{ $t('KbDocDrawer.rebuildCard') }}</v-btn>
                <v-btn v-if="canManage" size="small" variant="text" prepend-icon="mdi-refresh" :loading="busy.reindex" @click="reindex">{{ $t('KbDocDrawer.reindexAll') }}</v-btn>
                <v-spacer />
                <v-btn v-if="canManage" size="small" variant="text" color="error" prepend-icon="mdi-delete-outline" @click="$emit('delete', doc)">{{ $t('KbDocDrawer.delete') }}</v-btn>
                <v-tooltip v-else :text="$t('KbDocDrawer.ownerOnly')" location="top">
                    <template v-slot:activator="{ props }"><v-icon v-bind="props" size="16" color="grey">mdi-lock-outline</v-icon></template>
                </v-tooltip>
            </div>
        </template>

        <v-dialog v-model="previewDialog" max-width="1100" scrollable>
            <v-card>
                <v-card-title class="d-flex align-center text-subtitle-1">
                    {{ $t('KbDocDrawer.previewTitle') }}
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
import { DOC_STATES, INDEX_STATES } from './kbConstants';
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
        state() {
            const d = this.doc || {};
            if (d.index_status === 'pending' || d.index_status === 'processing') return 'pending';
            if (d.index_status === 'failed') return 'failed';
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
                else this.$emit('notify', { text: this.$t('KbDocDrawer.noDownloadUrl'), color: 'error' });
            } catch (e) {
                this.$emit('notify', { text: errorText(e, this.$t('KbDocDrawer.downloadFailed')), color: 'error' });
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
                if (!this.pages.length) this.previewError = this.$t('KbDocDrawer.noStoredText');
            } catch (e) {
                this.previewError = errorText(e, this.$t('KbDocDrawer.loadTextFailed'));
            } finally {
                this.busy.preview = false;
            }
        },
        async rebuild() {
            this.busy.card = true;
            try {
                const res = await rebuildCard(this.doc);
                this.$emit('notify', {
                    text: res?.summarized
                        ? this.$t('KbDocDrawer.cardRebuilt')
                        : this.$t('KbDocDrawer.cardResult', { status: res?.card_status || this.$t('KbDocDrawer.failed') }),
                    color: res?.summarized ? 'success' : 'warning'
                });
                this.$emit('changed');
            } catch (e) {
                this.$emit('notify', { text: errorText(e, this.$t('KbDocDrawer.cardRebuildFailed')), color: 'error' });
            } finally {
                this.busy.card = false;
            }
        },
        async reindex() {
            this.busy.reindex = true;
            try {
                await reindexFile(this.doc);
                this.$emit('notify', { text: this.$t('KbDocDrawer.reindexQueued'), color: 'success' });
                this.$emit('changed');
            } catch (e) {
                this.$emit('notify', { text: errorText(e, this.$t('KbDocDrawer.reindexFailed')), color: 'error' });
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

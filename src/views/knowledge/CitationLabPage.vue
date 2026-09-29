<template>
    <div class="lab">
        <aside class="lab__side">
            <div class="lab__head">
                <div class="text-subtitle-1 font-weight-bold">출처 뷰어 실험</div>
                <v-text-field v-model="folder" label="폴더" density="compact" hide-details variant="outlined" class="mt-2" />
                <v-file-input
                    label="QA셋(qa_set.json) 불러오기"
                    accept=".json,application/json"
                    density="compact"
                    variant="outlined"
                    hide-details
                    prepend-icon=""
                    prepend-inner-icon="mdi-file-upload-outline"
                    class="mt-2"
                    @update:model-value="loadQa"
                />
                <div v-if="qaError" class="lab__err">{{ qaError }}</div>
            </div>

            <div class="lab__list">
                <div
                    v-for="q in items"
                    :key="q.id"
                    :class="['lab__q', { 'lab__q--on': current && current.id === q.id }]"
                    @click="select(q)"
                >
                    <div class="lab__qid">{{ q.id }} · {{ q.type }}</div>
                    <div class="lab__qtext">{{ q.question }}</div>
                </div>
                <div v-if="!items.length" class="lab__hint">QA셋을 불러오거나 아래에서 직접 찾으세요.</div>
            </div>

            <div class="lab__manual">
                <div class="text-caption font-weight-bold mb-1">직접 찾기</div>
                <v-text-field v-model="manual.file" label="파일명" density="compact" hide-details variant="outlined" />
                <v-textarea v-model="manual.quote" label="인용 문장" rows="2" density="compact" hide-details variant="outlined" class="mt-1" />
                <v-btn size="small" color="primary" block class="mt-1" :disabled="!manual.file || !manual.quote" @click="findManual">찾기</v-btn>
            </div>
        </aside>

        <section class="lab__mid">
            <template v-if="current">
                <div class="text-caption text-medium-emphasis">{{ current.id }} · {{ current.type }}</div>
                <div class="lab__question">{{ current.question }}</div>
                <div class="lab__answer">{{ current.answer }}</div>
                <div v-if="current.ui_check" class="lab__check"><b>확인</b> {{ current.ui_check }}</div>
            </template>

            <div class="lab__sources">
                <div v-for="(s, i) in sources" :key="i" class="lab__src">
                    <div class="lab__srchead">
                        <v-icon size="16" class="mr-1">{{ iconOf(s.file) }}</v-icon>
                        <b>{{ s.file }}</b>
                        <span class="ml-2 text-medium-emphasis">{{ s.article }}</span>
                        <span v-if="s.page" class="ml-2 text-medium-emphasis">기대 {{ [].concat(s.page).join('·') }}쪽</span>
                    </div>
                    <div class="lab__quote">“{{ s.evidence }}”</div>
                    <div v-if="s.note" class="lab__note">{{ s.note }}</div>
                    <div class="lab__matches">
                        <span v-if="s.state === 'busy'" class="text-caption">찾는 중…</span>
                        <span v-else-if="s.state === 'error'" class="text-caption text-error">{{ s.error }}</span>
                        <span v-else-if="s.matches && !s.matches.length" class="text-caption text-error">원문에서 못 찾음</span>
                        <v-chip
                            v-for="(m, mi) in s.matches || []"
                            :key="mi"
                            size="small"
                            :color="isOpen(s, m) ? 'primary' : undefined"
                            :variant="isOpen(s, m) ? 'flat' : 'outlined'"
                            class="mr-1 mt-1"
                            @click="open(s, m)"
                        >
                            <span v-if="s.matches.length > 1" class="mr-1">{{ mi + 1 }}/{{ s.matches.length }}</span>
                            {{ matchLabel(m) }}
                        </v-chip>
                    </div>
                </div>
                <div v-if="current && !sources.length" class="lab__hint">출처가 없는 문항입니다. 답변이 "근거 없음"이어야 합니다.</div>
            </div>
        </section>

        <section class="lab__viewer">
            <CitationViewer v-if="viewing" :file-id="viewing.fileId" :start-block="viewing.start" :end-block="viewing.end" />
            <div v-else class="lab__hint lab__hint--center">출처 칩을 누르면 여기에 원문이 뜹니다.</div>
        </section>
    </div>
</template>

<script>
import CitationViewer from '@/components/knowledge/citation/CitationViewer.vue';
import { locateQuote } from '@/components/knowledge/citation/citationApi';

export default {
    name: 'CitationLabPage',
    components: { CitationViewer },
    data() {
        return {
            folder: '출처시각화',
            items: [],
            qaError: '',
            current: null,
            sources: [],
            viewing: null,
            manual: { file: '', quote: '' }
        };
    },
    methods: {
        async loadQa(files) {
            const file = [].concat(files || [])[0];
            if (!file) return;
            this.qaError = '';
            try {
                const data = JSON.parse(await file.text());
                this.items = data.items || [];
                if (this.items.length) this.select(this.items[0]);
            } catch (e) {
                this.qaError = 'JSON을 읽지 못했습니다: ' + e.message;
            }
        },
        select(q) {
            this.current = q;
            this.viewing = null;
            this.sources = (q.sources || []).map((s) => ({ ...s, state: 'busy', matches: null }));
            this.openFirst(this.sources);
        },
        async openFirst(sources) {
            await Promise.all(sources.map((s) => this.locate(s)));
            const first = sources.find((s) => s.matches && s.matches.length);
            if (first && sources === this.sources) this.open(first, first.matches[0]);
        },
        findManual() {
            this.current = null;
            this.viewing = null;
            const s = { file: this.manual.file.trim(), article: '', evidence: this.manual.quote.trim(), state: 'busy', matches: null };
            this.sources = [s];
            this.openFirst(this.sources);
        },
        async locate(s) {
            try {
                const data = await locateQuote({ path: `${this.folder}/${s.file}` }, s.evidence);
                s.fileId = data.file_id;
                s.matches = data.matches;
                s.state = 'done';
            } catch (e) {
                s.state = 'error';
                s.error = (e.response && e.response.data && e.response.data.detail) || e.message;
            }
        },
        open(s, m) {
            this.viewing = { fileId: s.fileId, start: m.start_block, end: m.end_block };
        },
        isOpen(s, m) {
            const v = this.viewing;
            return !!v && v.fileId === s.fileId && v.start === m.start_block && v.end === m.end_block;
        },
        matchLabel(m) {
            const where = m.pages ? `${m.pages.join('–')}쪽` : '';
            const blocks = m.start_block === m.end_block ? `b${m.start_block}` : `b${m.start_block}–${m.end_block}`;
            return [where, m.section, blocks].filter(Boolean).join(' · ');
        },
        iconOf(name) {
            if (/\.pdf$/i.test(name)) return 'mdi-file-pdf-box';
            if (/\.docx?$/i.test(name)) return 'mdi-file-word-box';
            return 'mdi-file-document-outline';
        }
    }
};
</script>

<style scoped>
.lab {
    display: grid;
    grid-template-columns: 300px minmax(320px, 1fr) minmax(420px, 1.3fr);
    gap: 12px;
    height: calc(100vh - 110px);
    padding: 12px;
}
.lab__side,
.lab__mid {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 8px;
    background: rgb(var(--v-theme-surface));
}
.lab__head {
    padding: 12px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.lab__err {
    color: rgb(var(--v-theme-error));
    font-size: 12px;
    margin-top: 4px;
}
.lab__list {
    flex: 1;
    overflow: auto;
}
.lab__q {
    padding: 8px 12px;
    cursor: pointer;
    border-bottom: 1px solid rgba(var(--v-border-color), 0.08);
}
.lab__q:hover {
    background: rgba(var(--v-theme-primary), 0.05);
}
.lab__q--on {
    background: rgba(var(--v-theme-primary), 0.1);
}
.lab__qid {
    font-size: 11px;
    color: rgba(var(--v-theme-on-surface), 0.6);
}
.lab__qtext {
    font-size: 13px;
}
.lab__manual {
    padding: 12px;
    border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.lab__mid {
    padding: 14px;
    overflow: auto;
}
.lab__question {
    font-size: 16px;
    font-weight: 700;
    margin: 4px 0 8px;
}
.lab__answer {
    font-size: 14px;
    line-height: 1.7;
}
.lab__check {
    margin-top: 10px;
    padding: 8px 10px;
    font-size: 12.5px;
    border-radius: 6px;
    background: rgba(var(--v-theme-info), 0.08);
}
.lab__sources {
    margin-top: 14px;
}
.lab__src {
    padding: 10px 0;
    border-top: 1px solid rgba(var(--v-border-color), 0.12);
}
.lab__srchead {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    font-size: 13px;
}
.lab__quote {
    font-size: 12.5px;
    margin-top: 4px;
    color: rgba(var(--v-theme-on-surface), 0.8);
}
.lab__note {
    font-size: 12px;
    margin-top: 4px;
    color: rgb(var(--v-theme-warning));
}
.lab__hint {
    padding: 16px;
    font-size: 13px;
    color: rgba(var(--v-theme-on-surface), 0.6);
}
.lab__hint--center {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px dashed rgba(var(--v-border-color), 0.4);
    border-radius: 8px;
}
.lab__viewer {
    min-height: 0;
}
@media (max-width: 1100px) {
    .lab {
        grid-template-columns: 1fr;
        height: auto;
    }
    .lab__viewer {
        height: 70vh;
    }
}
</style>

<template>
    <div class="cv">
        <div class="cv__bar">
            <div class="cv__title">
                <v-icon size="18" class="mr-1">{{ layoutIcon }}</v-icon>
                <span class="cv__name" :title="doc && doc.file_name">{{ doc ? doc.file_name : '' }}</span>
                <v-chip v-if="doc" size="x-small" variant="tonal" class="ml-2">{{ formatLabel }}</v-chip>
            </div>
            <div v-if="doc" class="cv__where">
                <v-icon size="14" class="mr-1">mdi-map-marker-outline</v-icon>
                {{ locationLabel }}
            </div>
        </div>

        <div v-if="loading" class="cv__status">
            <v-progress-circular indeterminate size="22" width="2" color="primary" class="mr-2" />
            {{ renderHint ? '문서를 쪽 이미지로 변환하는 중… (처음 한 번은 수십 초 걸릴 수 있습니다)' : '불러오는 중…' }}
        </div>
        <div v-else-if="error" class="cv__status cv__status--error">{{ error }}</div>

        <!-- 쪽이 있는 문서: 쪽 이미지 위에 인용 블록 bbox -->
        <template v-else-if="doc && doc.layout === 'paged'">
            <div class="cv__pager">
                <v-btn icon size="x-small" variant="text" :disabled="page <= 1" @click="page--">
                    <v-icon>mdi-chevron-left</v-icon>
                </v-btn>
                <span class="cv__pageno">{{ page }} / {{ doc.page_count }}쪽</span>
                <v-chip v-if="isRendition" size="x-small" variant="tonal" color="warning" class="ml-1" title="한글·Word에서 연 쪽 번호와 다를 수 있습니다">변환본 기준</v-chip>
                <v-btn icon size="x-small" variant="text" :disabled="page >= doc.page_count" @click="page++">
                    <v-icon>mdi-chevron-right</v-icon>
                </v-btn>
                <v-chip
                    v-for="p in citedPages"
                    :key="p"
                    size="x-small"
                    :color="p === page ? 'primary' : undefined"
                    :variant="p === page ? 'flat' : 'outlined'"
                    class="ml-1"
                    @click="page = p"
                >
                    인용 {{ p }}쪽
                </v-chip>
            </div>
            <div ref="scroller" class="cv__scroll">
                <div class="cv__page">
                    <img :key="page" :src="imageUrl" class="cv__img" alt="" @load="onImageLoad" />
                    <template v-if="pageSize">
                        <div v-for="(r, i) in pageRects" :key="i" class="cv__mark" :style="r" />
                    </template>
                </div>
            </div>
        </template>

        <!-- 흐르는 문서: 블록을 순서대로 그리고 인용 범위로 스크롤 -->
        <div v-else-if="doc" ref="scroller" class="cv__scroll cv__flow">
            <div
                v-for="b in doc.blocks"
                :key="b.block_index"
                :class="['cv__block', 'cv__block--' + b.kind, { 'cv__block--cited': isCited(b) }]"
                :data-block="b.block_index"
            >
                <table v-if="b.kind === 'table'" class="cv__table">
                    <tr v-for="(row, ri) in tableRows(b.text)" :key="ri">
                        <td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td>
                    </tr>
                </table>
                <div v-else :class="b.heading_level ? 'cv__h cv__h' + Math.min(b.heading_level, 3) : 'cv__p'">{{ b.text }}</div>
            </div>
        </div>
    </div>
</template>

<script>
import { fetchBlocks, locateQuote, pageImageUrl, PAGE_IMAGE_SCALE } from './citationApi';

const EXT_LABEL = { pdf: 'PDF', hwpx: 'HWPX', hwp: 'HWP', docx: 'DOCX', doc: 'DOC', pptx: 'PPTX', xlsx: 'XLSX' };

export default {
    name: 'CitationViewer',
    props: {
        fileId: { type: String, default: '' },
        // file_id 대신 지식베이스 경로(폴더/파일명)로 열 수 있다. 채팅 인용은 경로를 싣는다.
        path: { type: String, default: '' },
        // 모델이 적은 블록·쪽은 힌트다. 발췌가 앵커이고, 같은 문장이 여러 곳이면 힌트에 가까운 쪽을 고른다.
        startBlock: { type: Number, default: null },
        endBlock: { type: Number, default: null },
        pageHint: { type: Number, default: null },
        sectionTitle: { type: String, default: '' },
        quote: { type: String, default: '' }
    },
    data() {
        return { doc: null, loading: false, error: '', page: 1, pageSize: null, range: this.givenRange(), quoteMissed: false };
    },
    computed: {
        cited() {
            if (!this.doc) return [];
            return this.doc.blocks.filter((b) => this.isCited(b));
        },
        citedRects() {
            return this.cited.flatMap((b) => b.rects || []);
        },
        citedPages() {
            return [...new Set(this.citedRects.map((r) => r.page))].sort((a, b) => a - b);
        },
        isRendition() {
            return !!this.doc && this.doc.page_basis === 'rendition';
        },
        renderHint() {
            return /\.(hwpx|docx?|rtf|odt)$/i.test(this.fileId || this.path);
        },
        section() {
            if (!this.doc || !this.range) return null;
            return this.doc.sections.find((s) => s.start_block <= this.range.start && this.range.start <= s.end_block) || null;
        },
        ext() {
            const name = (this.doc && this.doc.file_name) || '';
            return name.includes('.') ? name.split('.').pop().toLowerCase() : '';
        },
        formatLabel() {
            const label = EXT_LABEL[this.ext] || this.ext.toUpperCase();
            if (this.doc.layout !== 'paged') return `${label} · 쪽 없음`;
            return this.isRendition ? `${label} · 변환본 ${this.doc.page_count}쪽` : `${label} · ${this.doc.page_count}쪽`;
        },
        layoutIcon() {
            return this.doc && this.doc.layout === 'paged' ? 'mdi-file-pdf-box' : 'mdi-file-document-outline';
        },
        locationLabel() {
            const parts = [];
            if (this.citedPages.length) {
                const [a, z] = [this.citedPages[0], this.citedPages[this.citedPages.length - 1]];
                const pages = a === z ? `${a}쪽` : `${a}–${z}쪽`;
                parts.push(this.isRendition ? `변환본 ${pages}` : pages);
            }
            if (this.section && this.section.title) parts.push(this.section.title);
            if (this.range) parts.push(this.range.start === this.range.end ? `b${this.range.start}` : `b${this.range.start}–${this.range.end}`);
            else parts.push('인용 위치를 찾지 못했습니다');
            if (this.range && this.quoteMissed) parts.push('발췌 문장을 원문에서 찾지 못해 섹션을 표시');
            return parts.join(' › ');
        },
        imageUrl() {
            return pageImageUrl(this.doc.file_id, this.page);
        },
        pageRects() {
            const [w, h] = this.pageSize;
            return this.citedRects
                .filter((r) => r.page === this.page && Array.isArray(r.bbox))
                .map((r) => {
                    const [x0, y0, x1, y1] = r.bbox;
                    return {
                        left: `${(x0 / w) * 100}%`,
                        top: `${((y0 - 1.5) / h) * 100}%`,
                        width: `${((x1 - x0) / w) * 100}%`,
                        height: `${((y1 - y0 + 3) / h) * 100}%`
                    };
                });
        }
    },
    watch: {
        fileId: 'load',
        path: 'load',
        startBlock: 'narrow',
        endBlock: 'narrow',
        pageHint: 'narrow',
        quote: 'narrow',
        page() {
            this.pageSize = null;
        }
    },
    mounted() {
        this.load();
    },
    methods: {
        isCited(b) {
            return !!this.range && b.block_index >= this.range.start && b.block_index <= this.range.end;
        },
        givenRange() {
            if (this.startBlock == null) return null;
            return { start: this.startBlock, end: this.endBlock == null ? this.startBlock : this.endBlock };
        },
        // 블록 번호는 한두 칸씩 어긋난다(process-gpt-codex docs/DESIGN_NOTES.md#citation-anchor). 겹치는 일치 → 가장 가까운 일치.
        pickMatch(matches, given) {
            if (!matches.length) return null;
            if (given) {
                const gap = (m) => Math.max(0, m.start_block - given.end, given.start - m.end_block);
                const off = (m) => Math.abs(m.start_block - given.start);
                return [...matches].sort((x, y) => gap(x) - gap(y) || off(x) - off(y))[0];
            }
            // 블록 힌트가 없으면 인용에 적힌 섹션 제목 → 쪽 → 첫 일치 순. 같은 문장이 현행·개정 조문에 겹쳐 나온다.
            const inTitle = matches.find((m) => this.titleHas(m.section));
            if (inTitle) return inTitle;
            if (this.pageHint != null) {
                const onPage = matches.find((m) => (m.pages || []).includes(this.pageHint));
                if (onPage) return onPage;
            }
            return matches[0];
        },
        // 인용 제목(`제2장 · 제26조(해고의 예고)`)의 한 조각이 섹션 제목과 같을 때만. 부분 문자열은 짧은 제목이 엉뚱하게 걸린다.
        titleHas(section) {
            const squash = (s) => (s || '').replace(/\s+/g, '');
            const target = squash(section);
            return !!target && (this.sectionTitle || '').split(/[·›>]/).some((part) => squash(part) === target);
        },
        async narrow() {
            const given = this.givenRange();
            this.range = given;
            this.quoteMissed = false;
            if (this.quote && this.doc) {
                let hit = null;
                try {
                    const { matches } = await locateQuote({ fileId: this.doc.file_id }, this.quote);
                    hit = this.pickMatch(matches || [], given);
                } catch (e) {
                    // 찾기 실패는 아래 대체 경로로
                }
                if (hit) {
                    this.range = { start: hit.start_block, end: hit.end_block };
                } else if (!given) {
                    const section = this.doc.sections.find((s) => this.titleHas(s.title));
                    if (section) this.range = { start: section.start_block, end: section.end_block };
                    this.quoteMissed = !!section;
                }
            }
            this.focus();
        },
        tableRows(text) {
            return text
                .split('\n')
                .filter((line) => line.trim().startsWith('|') && !/^\|?[\s:|-]+\|?$/.test(line.trim()))
                .map((line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
        },
        async load() {
            this.loading = true;
            this.error = '';
            this.doc = null;
            try {
                this.doc = await fetchBlocks(this.fileId ? { fileId: this.fileId } : { path: this.path });
                await this.narrow();
            } catch (e) {
                this.error = '문서를 불러오지 못했습니다: ' + ((e.response && e.response.data && e.response.data.detail) || e.message);
            } finally {
                this.loading = false;
            }
        },
        focus() {
            if (!this.doc) return;
            if (this.doc.layout === 'paged' && this.citedPages.length && !this.citedPages.includes(this.page)) {
                this.page = this.citedPages[0];
            } else if (this.doc.layout === 'paged' && !this.citedPages.length && this.pageHint) {
                this.page = Math.min(this.pageHint, this.doc.page_count || this.pageHint);
            }
            this.$nextTick(() => this.scrollToMark());
        },
        onImageLoad(e) {
            const img = e.target;
            this.pageSize = [img.naturalWidth / PAGE_IMAGE_SCALE, img.naturalHeight / PAGE_IMAGE_SCALE];
            this.$nextTick(() => this.scrollToMark());
        },
        scrollToMark() {
            if (!this.$el || !this.$el.querySelector) return;
            if (!this.range) return;
            const mark = this.$el.querySelector(`.cv__mark, [data-block="${this.range.start}"]`);
            if (mark) mark.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }
};
</script>

<style scoped>
.cv {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 8px;
    background: rgb(var(--v-theme-surface));
}
.cv__bar {
    padding: 10px 12px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.cv__title {
    display: flex;
    align-items: center;
    font-weight: 600;
    min-width: 0;
}
.cv__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.cv__where {
    margin-top: 4px;
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.7);
    display: flex;
    align-items: center;
}
.cv__status {
    padding: 24px;
    display: flex;
    align-items: center;
    font-size: 13px;
}
.cv__status--error {
    color: rgb(var(--v-theme-error));
}
.cv__pager {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 2px;
    padding: 4px 8px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.cv__pageno {
    font-size: 12px;
    min-width: 72px;
    text-align: center;
}
.cv__scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 12px;
    background: rgba(var(--v-theme-on-surface), 0.04);
}
.cv__page {
    position: relative;
    max-width: 820px;
    margin: 0 auto;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
    background: #fff;
}
.cv__img {
    display: block;
    width: 100%;
}
.cv__mark {
    position: absolute;
    background: rgba(255, 196, 0, 0.32);
    outline: 1.5px solid rgba(230, 150, 0, 0.9);
    border-radius: 2px;
    pointer-events: none;
}
.cv__flow {
    background: rgb(var(--v-theme-surface));
    font-size: 14px;
    line-height: 1.7;
}
.cv__block {
    padding: 2px 8px;
    border-left: 3px solid transparent;
    white-space: pre-wrap;
    word-break: keep-all;
}
.cv__block--cited {
    background: rgba(255, 196, 0, 0.22);
    border-left-color: rgb(230, 150, 0);
}
.cv__h {
    font-weight: 700;
    margin-top: 10px;
}
.cv__h1 {
    font-size: 17px;
}
.cv__h2 {
    font-size: 15.5px;
}
.cv__h3 {
    font-size: 14.5px;
}
.cv__table {
    border-collapse: collapse;
    margin: 6px 0;
    font-size: 13px;
}
.cv__table td {
    border: 1px solid rgba(var(--v-border-color), 0.4);
    padding: 3px 6px;
    vertical-align: top;
}
</style>

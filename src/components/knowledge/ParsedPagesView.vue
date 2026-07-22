<template>
    <div class="ppv" tabindex="0" @keydown="onKey">
        <!-- 상단 바: 요약 + 보기 모드 토글 + 복사/다운로드 -->
        <div class="ppv__bar">
            <div class="ppv__summary">
                <span v-if="fileName" class="ppv__name" :title="fileName">{{ fileName }}</span>
                <v-chip size="x-small" variant="tonal" color="primary">{{ pages.length }} 페이지</v-chip>
                <v-chip v-if="chunks && chunks.length" size="x-small" variant="tonal" color="secondary"> {{ chunks.length }} 청크 </v-chip>
                <span class="ppv__count">{{ totalChars.toLocaleString() }} 자</span>
            </div>
            <div class="ppv__tools">
                <v-btn-toggle v-model="mode" density="compact" variant="outlined" divided mandatory>
                    <v-btn value="rendered" size="small">렌더</v-btn>
                    <v-btn value="raw" size="small">원문</v-btn>
                    <v-btn v-if="chunks && chunks.length" value="chunks" size="small">청크</v-btn>
                </v-btn-toggle>
                <v-divider vertical class="mx-1" />
                <v-btn
                    :variant="showAll ? 'flat' : 'text'"
                    :color="showAll ? 'primary' : undefined"
                    size="small"
                    @click="showAll = !showAll"
                >
                    <v-icon size="16" start>{{ showAll ? 'mdi-file-multiple-outline' : 'mdi-file-outline' }}</v-icon>
                    {{ showAll ? '전체' : '한 장' }}
                </v-btn>
                <v-btn icon size="small" variant="text" title="전체 복사" @click="copyAll">
                    <v-icon size="16">mdi-content-copy</v-icon>
                </v-btn>
                <v-btn icon size="small" variant="text" title="다운로드(.md)" @click="downloadAll">
                    <v-icon size="16">mdi-download</v-icon>
                </v-btn>
            </div>
        </div>

        <div v-if="loading" class="ppv__status">
            <v-progress-circular indeterminate size="22" width="2" color="primary" class="mr-2" />
            파싱 중…
        </div>
        <div v-else-if="error" class="ppv__status ppv__status--error">{{ error }}</div>
        <div v-else-if="!items.length" class="ppv__status">표시할 내용이 없습니다.</div>

        <!-- 본문: 좌측 목록 + 우측 콘텐츠 -->
        <div v-else class="ppv__main">
            <!-- 좌측 페이지/청크 네비게이터 -->
            <div class="ppv__rail">
                <div
                    v-for="(it, i) in items"
                    :key="i"
                    class="ppv__rail-item"
                    :class="{ 'ppv__rail-item--active': !showAll && i === current }"
                    @click="select(i)"
                >
                    <span class="ppv__rail-no">{{
                        mode === 'chunks' ? '#' + (it.index != null ? it.index : i) : it.page_number != null ? it.page_number : i + 1
                    }}</span>
                    <span class="ppv__rail-snip">{{ snippet(it.content) }}</span>
                    <span class="ppv__rail-len">{{ (it.content || '').length.toLocaleString() }}</span>
                </div>
            </div>

            <!-- 우측 콘텐츠 -->
            <div class="ppv__content">
                <!-- 한 장 보기: 페이지 이동 컨트롤 -->
                <div v-if="!showAll" class="ppv__nav">
                    <v-btn icon size="x-small" variant="text" :disabled="current <= 0" @click="select(current - 1)">
                        <v-icon size="18">mdi-chevron-left</v-icon>
                    </v-btn>
                    <span class="ppv__nav-label">
                        {{ mode === 'chunks' ? '청크' : '페이지' }}
                        <strong>{{ current + 1 }}</strong> / {{ items.length }}
                    </span>
                    <v-btn icon size="x-small" variant="text" :disabled="current >= items.length - 1" @click="select(current + 1)">
                        <v-icon size="18">mdi-chevron-right</v-icon>
                    </v-btn>
                    <span v-if="mode === 'chunks' && cur && cur.section_title" class="ppv__nav-meta">{{ cur.section_title }}</span>
                </div>

                <div class="ppv__scroll" ref="scroll">
                    <!-- 한 장 -->
                    <template v-if="!showAll">
                        <div v-if="mode === 'rendered'" class="markdown-body ppv__md" v-html="renderMd(cur && cur.content)"></div>
                        <pre v-else class="ppv__raw">{{ cur && cur.content }}</pre>
                    </template>
                    <!-- 전체 -->
                    <template v-else>
                        <div v-for="(it, i) in items" :key="i" class="ppv__block">
                            <div class="ppv__block-head">
                                {{
                                    mode === 'chunks'
                                        ? '청크 #' + (it.index != null ? it.index : i)
                                        : '페이지 ' + (it.page_number != null ? it.page_number : i + 1)
                                }}
                            </div>
                            <div v-if="mode === 'rendered'" class="markdown-body ppv__md" v-html="renderMd(it.content)"></div>
                            <pre v-else class="ppv__raw">{{ it.content }}</pre>
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { marked } from 'marked';

export default {
    name: 'ParsedPagesView',
    props: {
        pages: { type: Array, default: () => [] },
        chunks: { type: Array, default: () => null },
        fileName: { type: String, default: '' },
        loading: { type: Boolean, default: false },
        error: { type: String, default: '' },
        // 지정 시 해당 page_number 페이지로 자동 이동(출처 뷰어에서 인용 페이지로 점프). 미지정이면 기존 동작.
        focusPage: { type: [Number, String], default: null }
    },
    data() {
        return { mode: 'rendered', showAll: false, current: 0 };
    },
    computed: {
        // 현재 보기 대상 목록 — 청크 모드면 chunks, 아니면 pages
        items() {
            return this.mode === 'chunks' ? this.chunks || [] : this.pages;
        },
        cur() {
            return this.items[this.current] || null;
        },
        totalChars() {
            return this.pages.reduce((n, p) => n + (p.content || '').length, 0);
        },
        combinedMd() {
            return this.pages
                .map((p, i) => `<!-- 페이지 ${p.page_number != null ? p.page_number : i + 1} -->\n\n${p.content || ''}`)
                .join('\n\n---\n\n');
        }
    },
    watch: {
        // 모드 전환 시 인덱스가 범위를 넘지 않게 보정
        mode() {
            this.current = 0;
            this.scrollTop();
        },
        // 페이지 로드/포커스 변경 시 인용 페이지로 이동
        pages: {
            handler() {
                this.applyFocus();
            },
            immediate: true
        },
        focusPage() {
            this.applyFocus();
        }
    },
    methods: {
        // focusPage(page_number) 가 지정되면 해당 페이지로 이동. 없으면 기존 동작(첫 페이지) 유지.
        applyFocus() {
            if (this.focusPage == null || this.focusPage === '' || this.mode === 'chunks') return;
            const target = Number(this.focusPage);
            if (!Number.isFinite(target)) return;
            const idx = this.pages.findIndex((p) => Number(p.page_number) === target);
            if (idx >= 0) this.select(idx);
        },
        snippet(text) {
            const t = (text || '')
                .replace(/[#*`>|\-\n\r]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            return t.slice(0, 40) || '(빈 내용)';
        },
        select(i) {
            if (i < 0 || i >= this.items.length) return;
            this.current = i;
            if (this.showAll) this.showAll = false;
            this.scrollTop();
        },
        scrollTop() {
            this.$nextTick(() => {
                if (this.$refs.scroll) this.$refs.scroll.scrollTop = 0;
            });
        },
        onKey(e) {
            if (this.showAll || !this.items.length) return;
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                this.select(this.current + 1);
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                this.select(this.current - 1);
            }
        },
        renderMd(text) {
            try {
                return marked.parse(text || '', { breaks: true, gfm: true });
            } catch (e) {
                return `<pre>${String(text || '').replace(/</g, '&lt;')}</pre>`;
            }
        },
        copyAll() {
            try {
                navigator.clipboard.writeText(this.combinedMd);
            } catch (e) {
                // ignore
            }
        },
        downloadAll() {
            const blob = new Blob([this.combinedMd], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const base = (this.fileName || 'parsed').replace(/\.[^.]+$/, '');
            a.download = `${base}.parsed.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }
};
</script>

<style scoped>
.ppv {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    outline: none;
}

.ppv__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
    flex-shrink: 0;
    flex-wrap: wrap;
}

.ppv__summary {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.ppv__name {
    font-size: 13px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 320px;
}

.ppv__count {
    font-size: 11px;
    color: rgba(var(--v-theme-on-surface), 0.5);
}

.ppv__tools {
    display: flex;
    align-items: center;
    gap: 4px;
}

.ppv__status {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: rgba(var(--v-theme-on-surface), 0.55);
}

.ppv__status--error {
    color: rgb(var(--v-theme-error));
}

/* 좌측 목록 + 우측 콘텐츠 */
.ppv__main {
    flex: 1;
    min-height: 0;
    display: flex;
    overflow: hidden;
}

.ppv__rail {
    width: 210px;
    flex-shrink: 0;
    overflow-y: auto;
    border-right: 1px solid rgba(var(--v-theme-on-surface), 0.12);
    padding: 6px;
}

.ppv__rail-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    line-height: 1.3;
}

.ppv__rail-item:hover {
    background: rgba(var(--v-theme-on-surface), 0.05);
}

.ppv__rail-item--active {
    background: rgba(var(--v-theme-primary), 0.12);
}

.ppv__rail-no {
    flex-shrink: 0;
    font-weight: 700;
    color: rgb(var(--v-theme-primary));
    min-width: 22px;
}

.ppv__rail-snip {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(var(--v-theme-on-surface), 0.6);
}

.ppv__rail-len {
    flex-shrink: 0;
    font-size: 10px;
    color: rgba(var(--v-theme-on-surface), 0.35);
}

.ppv__content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
}

.ppv__nav {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
    flex-shrink: 0;
}

.ppv__nav-label {
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.7);
}

.ppv__nav-meta {
    font-size: 11px;
    color: rgba(var(--v-theme-on-surface), 0.45);
    margin-left: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ppv__scroll {
    flex: 1;
    overflow: auto;
    padding: 14px 18px;
    min-height: 0;
}

.ppv__block {
    margin-bottom: 18px;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
    border-radius: 6px;
    overflow: hidden;
}

.ppv__block-head {
    font-size: 11px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.6);
    background: rgba(var(--v-theme-on-surface), 0.04);
    padding: 4px 10px;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.ppv__md {
    font-size: 13px;
    line-height: 1.6;
    color: rgb(var(--v-theme-on-surface));
}

.ppv__block .ppv__md,
.ppv__block .ppv__raw {
    padding: 12px 14px;
}

.ppv__raw {
    margin: 0;
    font-size: 12px;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'D2Coding', 'Consolas', monospace;
    color: rgba(var(--v-theme-on-surface), 0.85);
}

/* 마크다운 표/제목 — MarkdownViewer 와 동일 규칙 */
.markdown-body :deep(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 10px 0;
    font-size: 12px;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
    border: 1px solid rgba(var(--v-theme-on-surface), 0.2);
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
}

.markdown-body :deep(th) {
    background: rgba(var(--v-theme-primary), 0.08);
    font-weight: 600;
}

.markdown-body :deep(h1) {
    font-size: 18px;
    margin: 14px 0 8px;
    font-weight: 700;
}
.markdown-body :deep(h2) {
    font-size: 15px;
    margin: 14px 0 6px;
    font-weight: 600;
}
.markdown-body :deep(h3) {
    font-size: 13px;
    margin: 10px 0 4px;
    font-weight: 600;
}
.markdown-body :deep(p) {
    margin: 6px 0;
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
    margin: 6px 0;
    padding-left: 20px;
}
.markdown-body :deep(code) {
    background: rgba(var(--v-theme-on-surface), 0.08);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.92em;
}
.markdown-body :deep(img) {
    max-width: 100%;
}
.markdown-body :deep(hr) {
    border: none;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.15);
    margin: 12px 0;
}
</style>

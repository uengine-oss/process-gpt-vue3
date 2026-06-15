<template>
    <div class="markdown-viewer">
        <div class="markdown-viewer__toolbar">
            <span class="markdown-viewer__title" :title="fileName">{{ fileName }}</span>
            <div class="markdown-viewer__actions">
                <v-btn icon size="x-small" variant="text" title="복사" @click="copyMd">
                    <v-icon size="15">mdi-content-copy</v-icon>
                </v-btn>
                <v-btn icon size="x-small" variant="text" title="다운로드(.md)" @click="downloadMd">
                    <v-icon size="15">mdi-download</v-icon>
                </v-btn>
            </div>
        </div>
        <div v-if="loading" class="markdown-viewer__status">불러오는 중…</div>
        <div v-else-if="error" class="markdown-viewer__status">{{ error }}</div>
        <div v-else class="markdown-viewer__body markdown-body" v-html="renderedHtml"></div>
    </div>
</template>

<script>
import { marked } from 'marked';

export default {
    name: 'MarkdownViewer',
    props: {
        markdownContent: { type: String, default: '' },
        fileUrl: { type: String, default: '' },
        fileName: { type: String, default: 'Markdown' }
    },
    emits: ['close'],
    data() {
        return { fetchedContent: '', loading: false, error: '' };
    },
    computed: {
        effectiveContent() {
            return this.markdownContent || this.fetchedContent || '';
        },
        renderedHtml() {
            try {
                return marked.parse(this.effectiveContent, { breaks: true, gfm: true });
            } catch (e) {
                const safe = this.effectiveContent.replace(/</g, '&lt;');
                return `<pre>${safe}</pre>`;
            }
        }
    },
    watch: {
        fileUrl: { immediate: true, handler() { this.maybeFetch(); } }
    },
    methods: {
        async maybeFetch() {
            if (this.markdownContent || !this.fileUrl) return;
            this.loading = true;
            this.error = '';
            try {
                const resp = await fetch(this.fileUrl);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                this.fetchedContent = await resp.text();
            } catch (e) {
                this.error = '비교표를 불러오지 못했습니다.';
            } finally {
                this.loading = false;
            }
        },
        copyMd() {
            try {
                navigator.clipboard.writeText(this.effectiveContent);
            } catch (e) {
                // ignore
            }
        },
        downloadMd() {
            const blob = new Blob([this.effectiveContent], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const base = this.fileName || 'document';
            a.download = /\.md$/i.test(base) ? base : `${base}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }
};
</script>

<style scoped>
.markdown-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
}

.markdown-viewer__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 10px;
    border-bottom: 1px solid rgba(var(--v-theme-borderColor), 0.6);
    flex-shrink: 0;
    gap: 8px;
}

.markdown-viewer__title {
    font-size: 12px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(var(--v-theme-on-surface), 0.7);
}

.markdown-viewer__actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
}

.markdown-viewer__body {
    flex: 1;
    overflow: auto;
    padding: 16px 20px;
    font-size: 13px;
    line-height: 1.6;
    color: rgb(var(--v-theme-on-surface));
}

.markdown-viewer__status {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: rgba(var(--v-theme-on-surface), 0.5);
}

/* 비교표 등 markdown 표 렌더링 */
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
    white-space: nowrap;
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

.markdown-body :deep(hr) {
    border: none;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.15);
    margin: 12px 0;
}

.markdown-body :deep(strong) {
    font-weight: 600;
}
</style>

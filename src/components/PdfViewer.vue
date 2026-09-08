<template>
    <div class="pdf-viewer">
        <div class="pdf-viewer__toolbar">
            <span class="pdf-viewer__title" :title="fileName">{{ fileName }}</span>
            <span v-if="draft" class="pdf-viewer__draft" title="검수를 통과하지 않은 작성 중 문서입니다">작성 중</span>
            <div class="pdf-viewer__actions">
                <v-btn icon size="x-small" variant="text" title="새 탭에서 열기" @click="openNewTab">
                    <v-icon size="15">mdi-open-in-new</v-icon>
                </v-btn>
                <v-btn v-if="!draft" icon size="x-small" variant="text" :title="downloadTitle" @click="download">
                    <v-icon size="15">mdi-download</v-icon>
                </v-btn>
            </div>
        </div>
        <iframe v-if="fileUrl" :src="fileUrl" class="pdf-viewer__frame" title="PDF 미리보기"></iframe>
        <div v-else class="pdf-viewer__status">PDF를 불러올 수 없습니다.</div>
    </div>
</template>

<script>
export default {
    name: 'PdfViewer',
    props: {
        fileUrl: { type: String, default: '' },
        fileName: { type: String, default: 'document.pdf' },
        downloadUrl: { type: String, default: '' },
        // 작성 중인 문서: 보기만 하고 내려받지 않는다. 검수를 통과하지 않았다.
        draft: { type: Boolean, default: false },
        downloadFileName: { type: String, default: '' },
        downloadTitle: { type: String, default: '다운로드(PDF)' }
    },
    emits: ['close'],
    methods: {
        openNewTab() {
            if (this.fileUrl) window.open(this.fileUrl, '_blank', 'noopener');
        },
        download() {
            const url = this.downloadUrl || this.fileUrl;
            if (!url) return;
            const a = document.createElement('a');
            a.href = url;
            const base = this.downloadFileName || this.fileName || 'document.pdf';
            a.download = base;
            // 크로스 오리진이면 download 속성이 무시될 수 있어 새 탭 fallback 도 허용
            a.target = '_blank';
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    }
};
</script>

<style scoped>
.pdf-viewer__draft {
    flex: 0 0 auto;
    margin-left: 8px;
    padding: 1px 7px;
    border-radius: 9px;
    font-size: 11px;
    line-height: 16px;
    color: #8a6100;
    background: #fff4d6;
    border: 1px solid #f0d089;
}

.pdf-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
}

.pdf-viewer__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 10px;
    border-bottom: 1px solid rgba(var(--v-theme-borderColor), 0.6);
    flex-shrink: 0;
    gap: 8px;
}

.pdf-viewer__title {
    font-size: 12px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(var(--v-theme-on-surface), 0.7);
}

.pdf-viewer__actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
}

.pdf-viewer__frame {
    flex: 1;
    width: 100%;
    border: none;
    background: #525659;
}

.pdf-viewer__status {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: rgba(var(--v-theme-on-surface), 0.5);
}
</style>

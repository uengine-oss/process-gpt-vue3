<template>
    <div class="hwpn">
        <div class="hwpn__header">
            <div class="hwpn__title">미리보기</div>
            <div class="hwpn__actions">
                <template v-if="!isLoading && !hasError">
                    <span class="hwpn__pages">{{ pageCount }}쪽</span>
                    <v-btn icon variant="text" density="comfortable" size="small" :disabled="zoom <= 0.5" @click="setZoom(zoom - 0.25)">
                        <v-icon size="18">mdi-magnify-minus-outline</v-icon>
                    </v-btn>
                    <span class="hwpn__zoom">{{ Math.round(zoom * 100) }}%</span>
                    <v-btn icon variant="text" density="comfortable" size="small" :disabled="zoom >= 2" @click="setZoom(zoom + 0.25)">
                        <v-icon size="18">mdi-magnify-plus-outline</v-icon>
                    </v-btn>
                </template>
                <v-btn v-if="fileUrl" variant="text" density="comfortable" size="small" @click="$emit('download')">
                    <v-icon size="16" class="mr-1">mdi-download</v-icon>
                    다운로드
                </v-btn>
                <v-btn icon variant="text" density="comfortable" size="small" @click="$emit('close')">
                    <v-icon size="18">mdi-close</v-icon>
                </v-btn>
            </div>
        </div>

        <div class="hwpn__body">
            <div v-if="isLoading" class="hwpn__state">
                <v-progress-circular indeterminate color="primary" :size="22" />
                <span class="text-caption ml-2">{{ loadingText }}</span>
            </div>
            <div v-else-if="hasError" class="hwpn__state hwpn__state--error">
                <v-icon size="18" color="error">mdi-alert-circle-outline</v-icon>
                <span class="text-caption ml-2">문서를 불러올 수 없습니다.</span>
            </div>
            <div v-else class="hwpn__scroll" ref="scroll">
                <div
                    v-for="page in pages"
                    :key="page.index"
                    class="hwpn__page"
                    :data-index="page.index"
                    :style="pageStyle(page)"
                    ref="pageEls"
                >
                    <div v-if="page.svg" class="hwpn__svg" v-html="page.svg"></div>
                    <div v-else class="hwpn__skeleton">{{ page.index + 1 }}</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { openDocument } from '@/utils/hwp/rhwp.js';

// 화면 밖 페이지까지 미리 그려두는 여유분 (스크롤 시 빈 칸이 보이지 않게)
const PRERENDER_MARGIN = '600px';

export default {
    name: 'HwpxNativeViewer',
    props: {
        /** 원본 .hwpx / .hwp 파일 URL */
        fileUrl: { type: String, default: '' }
    },
    emits: ['close', 'download'],
    data() {
        return {
            isLoading: true,
            hasError: false,
            loadingText: '문서를 불러오는 중...',
            doc: null,
            pageCount: 0,
            pages: [],
            zoom: 1,
            baseWidth: 794,
            baseHeight: 1123,
            observer: null
        };
    },
    watch: {
        fileUrl: { immediate: true, handler: 'load' }
    },
    methods: {
        async load() {
            this.teardown();
            if (!this.fileUrl) {
                this.isLoading = false;
                this.hasError = false;
                this.pages = [];
                return;
            }
            this.isLoading = true;
            this.hasError = false;
            this.loadingText = '문서를 불러오는 중...';

            try {
                const resp = await fetch(this.fileUrl);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const bytes = new Uint8Array(await resp.arrayBuffer());

                this.loadingText = '문서를 여는 중...';
                this.doc = await openDocument(bytes);
                this.pageCount = this.doc.pageCount();
                this.pages = Array.from({ length: this.pageCount }, (_, i) => ({ index: i, svg: '' }));

                // 첫 페이지를 먼저 그려 실제 용지 비율을 잡는다
                const first = this.renderPage(0);
                if (first) this.readPageBox(first);

                this.isLoading = false;
                this.$nextTick(() => this.observePages());
            } catch (e) {
                console.error('[HwpxNativeViewer] 렌더 실패', e);
                this.isLoading = false;
                this.hasError = true;
            }
        },

        renderPage(index) {
            const page = this.pages[index];
            if (!page || page.svg || !this.doc) return page?.svg || '';
            try {
                page.svg = this.doc.renderPageSvg(index);
            } catch (e) {
                console.warn(`[HwpxNativeViewer] ${index + 1}쪽 렌더 실패`, e);
                page.svg = '';
            }
            return page.svg;
        },

        /** 첫 페이지 SVG 의 viewBox 로 용지 크기를 잡는다 (A4 가정 대신 실제값). */
        readPageBox(svgText) {
            const m = /viewBox="([\d.\s-]+)"/.exec(svgText || '');
            if (!m) return;
            const [, , w, h] = m[1].trim().split(/\s+/).map(Number);
            if (w > 0 && h > 0) {
                this.baseWidth = w;
                this.baseHeight = h;
            }
        },

        observePages() {
            this.observer?.disconnect();
            const root = this.$refs.scroll;
            const els = this.$refs.pageEls;
            if (!root || !els?.length) return;
            this.observer = new IntersectionObserver(
                (entries) => {
                    for (const entry of entries) {
                        if (!entry.isIntersecting) continue;
                        const idx = Number(entry.target.getAttribute('data-index'));
                        if (Number.isInteger(idx)) this.renderPage(idx);
                    }
                },
                { root, rootMargin: PRERENDER_MARGIN }
            );
            els.forEach((el) => el && this.observer.observe(el));
        },

        pageStyle(page) {
            return {
                width: `${Math.round(this.baseWidth * this.zoom)}px`,
                height: `${Math.round(this.baseHeight * this.zoom)}px`
            };
        },

        setZoom(next) {
            this.zoom = Math.min(2, Math.max(0.5, Number(next.toFixed(2))));
        },

        teardown() {
            this.observer?.disconnect();
            this.observer = null;
            this.doc = null;
            this.pages = [];
            this.pageCount = 0;
        }
    },
    beforeUnmount() {
        this.teardown();
    }
};
</script>

<style scoped>
.hwpn {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.hwpn__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px 8px 12px;
    border-bottom: 1px solid rgba(var(--v-theme-borderColor), 0.7);
}

.hwpn__title {
    font-size: 14px;
    font-weight: 600;
}

.hwpn__actions {
    display: flex;
    align-items: center;
    gap: 2px;
}

.hwpn__pages,
.hwpn__zoom {
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.6);
    padding: 0 4px;
    white-space: nowrap;
}

.hwpn__body {
    flex: 1;
    min-height: 0;
    position: relative;
}

.hwpn__state {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
}

.hwpn__state--error {
    color: rgb(var(--v-theme-error));
}

.hwpn__scroll {
    height: 100%;
    overflow: auto;
    background: #f1f3f5;
    padding: 16px 0 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
}

.hwpn__page {
    background: #fff;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.16);
    flex: none;
    overflow: hidden;
}

/* rhwp 가 만든 SVG 는 고정 px 크기를 갖는다 — 페이지 박스에 맞춰 늘린다. */
.hwpn__svg,
.hwpn__svg :deep(svg) {
    width: 100%;
    height: 100%;
    display: block;
}

.hwpn__skeleton {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(0, 0, 0, 0.18);
    font-size: 28px;
    font-weight: 600;
}
</style>

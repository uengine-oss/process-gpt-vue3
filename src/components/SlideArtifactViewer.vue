<template>
    <div class="slide-viewer">
        <!-- 슬라이드 영역 (스와이프 지원) -->
        <div
            class="slide-viewer__stage"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
        >
            <transition :name="swipeTransition">
                <div class="slide-viewer__card" :key="currentIndex">
                    <!-- 이미지가 있는 슬라이드 -->
                    <img
                        v-if="currentSlide.image"
                        :src="currentSlide.image"
                        class="slide-viewer__image"
                        alt=""
                        draggable="false"
                        @error="onImgError"
                    />
                    <!-- 마크다운 전용 슬라이드 -->
                    <div v-else class="slide-viewer__md" v-html="currentSlide.html"></div>
                </div>
            </transition>
        </div>

        <!-- 하단 컨트롤 -->
        <div class="slide-viewer__controls">
            <button class="slide-viewer__btn" :disabled="currentIndex === 0" @click="prev">
                <v-icon size="18">mdi-chevron-left</v-icon>
            </button>
            <span class="slide-viewer__counter">{{ currentIndex + 1 }} / {{ slides.length }}</span>
            <button class="slide-viewer__btn" :disabled="currentIndex === slides.length - 1" @click="next">
                <v-icon size="18">mdi-chevron-right</v-icon>
            </button>
            <button
                class="slide-viewer__btn slide-viewer__btn--edit"
                title="이 슬라이드 수정"
                :disabled="!currentSlide.image"
                @click="openEditDialog"
            >
                <v-icon size="16">mdi-pencil</v-icon>
            </button>
            <button class="slide-viewer__btn slide-viewer__btn--expand" title="크게 보기" @click="fullscreen = true">
                <v-icon size="16">mdi-arrow-expand</v-icon>
            </button>
            <button class="slide-viewer__btn" title="PPTX 다운로드" :disabled="exporting" @click="downloadPptx">
                <v-icon size="16">mdi-download</v-icon>
            </button>
        </div>

        <!-- 편집 풀스크린 -->
        <teleport to="body">
            <transition name="fade">
                <div v-if="editDialog" class="slide-edit" @keydown.esc="cancelEdit" tabindex="0" ref="editOverlay">
                    <!-- 상단 바 -->
                    <div class="slide-edit__topbar">
                        <span class="slide-edit__title">슬라이드 {{ currentIndex + 1 }} 수정</span>
                        <div class="slide-edit__topbar-right">
                            <template v-if="editStep === 'compare'">
                                <div class="slide-edit__toggle">
                                    <button
                                        class="slide-edit__toggle-btn"
                                        :class="{ 'is-active': compareTab === 'before' }"
                                        @click="compareTab = 'before'"
                                    >
                                        수정 전
                                    </button>
                                    <button
                                        class="slide-edit__toggle-btn"
                                        :class="{ 'is-active': compareTab === 'after' }"
                                        @click="compareTab = 'after'"
                                    >
                                        수정 후
                                    </button>
                                </div>
                            </template>
                            <button class="slide-edit__close" @click="cancelEdit">
                                <v-icon size="20" color="white">mdi-close</v-icon>
                            </button>
                        </div>
                    </div>

                    <!-- 메인 이미지 영역 -->
                    <div class="slide-edit__body">
                        <!-- 입력 모드: 이미지 위 드래그 영역 선택 + 하단 입력바 -->
                        <template v-if="editStep === 'input'">
                            <div class="slide-edit__image-area">
                                <div
                                    class="slide-edit__canvas-wrap"
                                    ref="canvasWrap"
                                    @mousedown="onRegionMouseDown"
                                    @mousemove="onRegionMouseMove"
                                    @mouseup="onRegionMouseUp"
                                    @mouseleave="onRegionMouseUp"
                                >
                                    <img
                                        ref="editImg"
                                        :src="currentSlide.image"
                                        class="slide-edit__img"
                                        draggable="false"
                                        alt=""
                                        @load="onEditImgLoad"
                                    />
                                    <!-- 선택 영역 표시 -->
                                    <div v-if="regionDisplay" class="slide-edit__region" :style="regionStyle"></div>
                                </div>
                                <div v-if="!regionDisplay" class="slide-edit__hint">
                                    드래그로 수정할 영역을 선택하세요 (선택 안 하면 전체 수정)
                                </div>
                                <div v-else class="slide-edit__hint">영역 선택됨 — 다시 드래그하면 재지정</div>
                            </div>
                            <!-- 참조 이미지 미리보기 -->
                            <div v-if="editRefImage" class="slide-edit__ref-bar">
                                <img :src="editRefImage.dataUrl" class="slide-edit__ref-thumb" alt="" />
                                <span class="slide-edit__ref-label">참조 이미지</span>
                                <button class="slide-edit__ref-remove" @click="clearRefImage">
                                    <v-icon size="14">mdi-close</v-icon>
                                </button>
                            </div>
                            <div class="slide-edit__input-bar">
                                <button class="slide-edit__attach" title="참조 이미지 첨부" @click="$refs.refFileInput.click()">
                                    <v-icon size="18">mdi-image-plus</v-icon>
                                </button>
                                <input
                                    ref="refFileInput"
                                    type="file"
                                    accept="image/*"
                                    style="display: none"
                                    @change="handleRefImageUpload"
                                />
                                <textarea
                                    v-model="editInstruction"
                                    class="slide-edit__input"
                                    rows="1"
                                    placeholder="수정할 내용을 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"
                                    @keydown.enter.exact.prevent="submitEdit"
                                ></textarea>
                                <button class="slide-edit__send" :disabled="!editInstruction.trim()" @click="submitEdit">
                                    <v-icon size="18">mdi-send</v-icon>
                                </button>
                            </div>
                        </template>

                        <!-- 로딩 -->
                        <template v-else-if="editStep === 'loading'">
                            <div class="slide-edit__image-area">
                                <img :src="editOriginalUrl" class="slide-edit__img slide-edit__img--dimmed" alt="" />
                                <div class="slide-edit__loading-overlay">
                                    <v-progress-circular indeterminate color="primary" :size="56" :width="4" />
                                    <p class="slide-edit__loading-text">Gemini가 이미지를 수정하고 있습니다...</p>
                                </div>
                            </div>
                        </template>

                        <!-- 비교 모드: 탭으로 전/후 전환 -->
                        <template v-else-if="editStep === 'compare'">
                            <div class="slide-edit__image-area">
                                <transition name="fade" mode="out-in">
                                    <img
                                        :key="compareTab"
                                        :src="compareTab === 'before' ? editOriginalUrl : editResultUrl"
                                        class="slide-edit__img"
                                        alt=""
                                    />
                                </transition>
                            </div>
                            <div class="slide-edit__compare-actions">
                                <button class="slide-edit__action-btn slide-edit__action-btn--ghost" @click="cancelEdit">취소</button>
                                <button class="slide-edit__action-btn slide-edit__action-btn--ghost" @click="editStep = 'input'">
                                    다시 수정
                                </button>
                                <button class="slide-edit__action-btn slide-edit__action-btn--primary" @click="applyEdit">
                                    <v-icon size="16" class="mr-1">mdi-check</v-icon> 적용
                                </button>
                            </div>
                        </template>

                        <!-- 에러 -->
                        <template v-else-if="editStep === 'error'">
                            <div class="slide-edit__image-area">
                                <div class="slide-edit__error-content">
                                    <v-icon size="56" color="error">mdi-alert-circle-outline</v-icon>
                                    <p class="slide-edit__error-text">{{ editError }}</p>
                                    <div style="display: flex; gap: 8px; margin-top: 20px">
                                        <button class="slide-edit__action-btn slide-edit__action-btn--ghost" @click="cancelEdit">
                                            닫기
                                        </button>
                                        <button class="slide-edit__action-btn slide-edit__action-btn--primary" @click="editStep = 'input'">
                                            다시 시도
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>
            </transition>
        </teleport>

        <!-- 풀스크린 오버레이 -->
        <teleport to="body">
            <transition name="fade">
                <div
                    v-if="fullscreen"
                    class="slide-fullscreen"
                    @click.self="fullscreen = false"
                    @keydown.esc="fullscreen = false"
                    tabindex="0"
                    ref="fullscreenEl"
                >
                    <div
                        class="slide-fullscreen__stage"
                        @pointerdown="onPointerDown"
                        @pointermove="onPointerMove"
                        @pointerup="onPointerUp"
                        @pointercancel="onPointerUp"
                    >
                        <transition :name="swipeTransition">
                            <div class="slide-fullscreen__card" :key="currentIndex">
                                <img
                                    v-if="currentSlide.image"
                                    :src="currentSlide.image"
                                    class="slide-fullscreen__image"
                                    alt=""
                                    draggable="false"
                                />
                                <div v-else class="slide-fullscreen__md" v-html="currentSlide.html"></div>
                            </div>
                        </transition>
                    </div>
                    <div class="slide-fullscreen__controls">
                        <button class="slide-viewer__btn" :disabled="currentIndex === 0" @click="prev">
                            <v-icon size="22">mdi-chevron-left</v-icon>
                        </button>
                        <span class="slide-fullscreen__counter">{{ currentIndex + 1 }} / {{ slides.length }}</span>
                        <button class="slide-viewer__btn" :disabled="currentIndex === slides.length - 1" @click="next">
                            <v-icon size="22">mdi-chevron-right</v-icon>
                        </button>
                    </div>
                    <button class="slide-fullscreen__close" @click="fullscreen = false">
                        <v-icon size="22">mdi-close</v-icon>
                    </button>
                </div>
            </transition>
        </teleport>

        <!-- 슬라이드 썸네일 스트립 -->
        <div class="slide-viewer__strip" ref="strip">
            <button
                v-for="(slide, i) in slides"
                :key="i"
                class="slide-viewer__thumb"
                :class="{ 'is-active': i === currentIndex }"
                @click="goTo(i)"
            >
                <img v-if="slide.image" :src="slide.image" class="slide-viewer__thumb-img" alt="" />
                <span v-else class="slide-viewer__thumb-text">{{ slide.title || `#${i + 1}` }}</span>
            </button>
        </div>
    </div>
</template>

<script>
import { marked } from 'marked';
import pptxgen from 'pptxgenjs';

export default {
    name: 'SlideArtifactViewer',
    props: {
        slideMarkdown: { type: String, default: '' },
        imageUrls: { type: Array, default: () => [] }
    },
    data() {
        return {
            currentIndex: 0,
            fullscreen: false,
            exporting: false,
            // 편집
            editDialog: false,
            editStep: 'input', // input | loading | compare | error
            editInstruction: '',
            editOriginalUrl: '',
            editResultUrl: '',
            editError: '',
            compareTab: 'after',
            // 영역 선택
            regionDragging: false,
            regionStartX: 0,
            regionStartY: 0,
            regionDisplay: null, // { left, top, width, height } in px (display coords)
            regionNatural: null, // { x1, y1, x2, y2, width, height } in natural image pixels
            editImgRect: null, // { left, top, width, height, scale } of rendered img
            editRefImage: null, // { dataUrl, base64, mimeType } 참조 이미지
            // 스와이프
            swipeStartX: 0,
            swipeStartY: 0,
            swiping: false,
            swipeTransition: 'slide-left'
        };
    },
    computed: {
        slides() {
            const raw = (this.slideMarkdown || '').trim();
            if (!raw) return [{ title: '', body: '', html: '<p>슬라이드 없음</p>', image: null }];

            const parts = raw
                .split(/\n---\n/)
                .map((s) => s.trim())
                .filter(Boolean);
            return parts.map((part, i) => {
                const lines = part.split('\n');
                // 첫 번째 #으로 시작하는 줄을 타이틀로
                const titleLine = lines.find((l) => /^#{1,3}\s/.test(l));
                const title = titleLine ? titleLine.replace(/^#{1,3}\s*/, '') : '';

                // 마크다운 → HTML
                let html = '';
                try {
                    html = marked.parse(part, { breaks: true });
                } catch {
                    html = `<pre>${part}</pre>`;
                }

                // 이미지: imageUrls 배열에서 매칭, 또는 마크다운 내 ![](url)
                let image = null;
                if (this.imageUrls && this.imageUrls[i]) {
                    image = this.imageUrls[i];
                }
                // 마크다운에 인라인 이미지가 있으면 그걸 사용
                const imgMatch = part.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
                if (imgMatch) {
                    image = imgMatch[1];
                }

                return { title, body: part, html, image };
            });
        },
        currentSlide() {
            return this.slides[this.currentIndex] || this.slides[0];
        },
        regionStyle() {
            if (!this.regionDisplay) return {};
            return {
                left: this.regionDisplay.left + 'px',
                top: this.regionDisplay.top + 'px',
                width: this.regionDisplay.width + 'px',
                height: this.regionDisplay.height + 'px'
            };
        }
    },
    methods: {
        prev() {
            if (this.currentIndex > 0) {
                this.swipeTransition = 'slide-right';
                this.currentIndex--;
                this.scrollThumbIntoView();
            }
        },
        next() {
            if (this.currentIndex < this.slides.length - 1) {
                this.swipeTransition = 'slide-left';
                this.currentIndex++;
                this.scrollThumbIntoView();
            }
        },
        // ── 스와이프 / 드래그 ──
        onPointerDown(e) {
            this.swiping = true;
            this.swipeStartX = e.clientX;
            this.swipeStartY = e.clientY;
            e.currentTarget.setPointerCapture(e.pointerId);
        },
        onPointerMove(e) {
            // 선택적: 드래그 중 시각 피드백 넣고 싶으면 여기서
        },
        onPointerUp(e) {
            if (!this.swiping) return;
            this.swiping = false;
            const dx = e.clientX - this.swipeStartX;
            const dy = e.clientY - this.swipeStartY;
            // 수평 이동이 50px 이상이고, 수직보다 클 때만 슬라이드 전환
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
                if (dx < 0) this.next();
                else this.prev();
            }
        },
        goTo(i) {
            this.swipeTransition = i > this.currentIndex ? 'slide-left' : 'slide-right';
            this.currentIndex = i;
        },
        scrollThumbIntoView() {
            this.$nextTick(() => {
                const strip = this.$refs.strip;
                if (!strip) return;
                const thumb = strip.children[this.currentIndex];
                if (thumb) thumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            });
        },
        async downloadPptx() {
            if (this.exporting) return;
            this.exporting = true;
            try {
                const pres = new pptxgen();
                pres.layout = 'LAYOUT_16x9';

                for (const slide of this.slides) {
                    const pptSlide = pres.addSlide();

                    if (slide.image) {
                        // 이미지 슬라이드: 이미지를 fetch → base64 → 전체 배경으로 삽입
                        try {
                            const resp = await fetch(slide.image);
                            const blob = await resp.blob();
                            const base64 = await this.blobToBase64(blob);
                            pptSlide.addImage({ data: base64, x: 0, y: 0, w: '100%', h: '100%' });
                        } catch {
                            // 이미지 fetch 실패 시 텍스트 폴백
                            this.addTextSlide(pptSlide, slide);
                        }
                    } else {
                        this.addTextSlide(pptSlide, slide);
                    }
                }

                await pres.writeFile({ fileName: '슬라이드.pptx' });
            } catch (err) {
                console.error('[SlideViewer] PPTX 내보내기 실패:', err);
            } finally {
                this.exporting = false;
            }
        },
        addTextSlide(pptSlide, slide) {
            const lines = slide.body.split('\n');
            let title = '';
            const bodyLines = [];

            for (const line of lines) {
                if (!title && /^#{1,3}\s/.test(line)) {
                    title = line.replace(/^#{1,3}\s*/, '');
                } else {
                    bodyLines.push(line.replace(/^[-*]\s*/, ''));
                }
            }
            const body = bodyLines.filter(Boolean).join('\n');

            if (title) {
                pptSlide.addText(title, {
                    x: 0.5,
                    y: 0.4,
                    w: '90%',
                    fontSize: 32,
                    bold: true,
                    color: '1d1d1f'
                });
            }
            if (body) {
                pptSlide.addText(body, {
                    x: 0.5,
                    y: title ? 1.4 : 0.5,
                    w: '90%',
                    h: title ? 4 : 5,
                    fontSize: 18,
                    color: '444444',
                    lineSpacingMultiple: 1.4
                });
            }
        },
        blobToBase64(blob) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        },
        // ── 편집 ──
        openEditDialog() {
            if (!this.currentSlide.image) return;
            this.editOriginalUrl = this.currentSlide.image;
            this.editInstruction = '';
            this.editResultUrl = '';
            this.editError = '';
            this.editStep = 'input';
            this.compareTab = 'after';
            this.regionDisplay = null;
            this.regionNatural = null;
            this.editImgRect = null;
            this.editRefImage = null;
            this.editDialog = true;
            this.$nextTick(() => {
                this.$refs.editOverlay?.focus();
            });
            document.body.style.overflow = 'hidden';
        },
        // ── 영역 선택 ──
        onEditImgLoad() {
            this.calcEditImgRect();
        },
        calcEditImgRect() {
            const img = this.$refs.editImg;
            const wrap = this.$refs.canvasWrap;
            if (!img || !wrap) return;
            const wrapRect = wrap.getBoundingClientRect();
            const imgRect = img.getBoundingClientRect();
            this.editImgRect = {
                left: imgRect.left - wrapRect.left,
                top: imgRect.top - wrapRect.top,
                width: imgRect.width,
                height: imgRect.height,
                scale: img.naturalWidth / imgRect.width
            };
        },
        onRegionMouseDown(e) {
            this.calcEditImgRect();
            if (!this.editImgRect) return;
            const wrap = this.$refs.canvasWrap;
            const wrapRect = wrap.getBoundingClientRect();
            const x = e.clientX - wrapRect.left - this.editImgRect.left;
            const y = e.clientY - wrapRect.top - this.editImgRect.top;
            // 이미지 영역 밖이면 무시
            if (x < 0 || y < 0 || x > this.editImgRect.width || y > this.editImgRect.height) return;
            this.regionDragging = true;
            this.regionStartX = x;
            this.regionStartY = y;
            this.regionDisplay = null;
            this.regionNatural = null;
        },
        onRegionMouseMove(e) {
            if (!this.regionDragging || !this.editImgRect) return;
            const wrap = this.$refs.canvasWrap;
            const wrapRect = wrap.getBoundingClientRect();
            let x = e.clientX - wrapRect.left - this.editImgRect.left;
            let y = e.clientY - wrapRect.top - this.editImgRect.top;
            x = Math.max(0, Math.min(x, this.editImgRect.width));
            y = Math.max(0, Math.min(y, this.editImgRect.height));
            const left = Math.min(this.regionStartX, x);
            const top = Math.min(this.regionStartY, y);
            const width = Math.abs(x - this.regionStartX);
            const height = Math.abs(y - this.regionStartY);
            if (width > 4 || height > 4) {
                this.regionDisplay = {
                    left: this.editImgRect.left + left,
                    top: this.editImgRect.top + top,
                    width,
                    height
                };
            }
        },
        onRegionMouseUp() {
            if (!this.regionDragging) return;
            this.regionDragging = false;
            if (!this.regionDisplay || !this.editImgRect) return;
            const s = this.editImgRect.scale;
            const dispLeft = this.regionDisplay.left - this.editImgRect.left;
            const dispTop = this.regionDisplay.top - this.editImgRect.top;
            const img = this.$refs.editImg;
            this.regionNatural = {
                x1: Math.round(dispLeft * s),
                y1: Math.round(dispTop * s),
                x2: Math.round((dispLeft + this.regionDisplay.width) * s),
                y2: Math.round((dispTop + this.regionDisplay.height) * s),
                width: img?.naturalWidth || 0,
                height: img?.naturalHeight || 0
            };
        },
        handleRefImageUpload(e) {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target.result;
                const base64 = String(dataUrl).split(',')[1];
                this.editRefImage = { dataUrl, base64, mimeType: file.type };
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        },
        clearRefImage() {
            this.editRefImage = null;
        },
        async buildOverlayImage() {
            // 원본 이미지 + 선택 영역에 파란 점선 테두리를 그린 PNG를 반환
            if (!this.regionNatural) return null;
            // fetch로 이미지 가져와서 tainted canvas 회피
            const imgEl = this.$refs.editImg;
            if (!imgEl) return null;
            try {
                const resp = await fetch(imgEl.src);
                const blob = await resp.blob();
                const bmp = await createImageBitmap(blob);
                const canvas = document.createElement('canvas');
                const w = bmp.width;
                const h = bmp.height;
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(bmp, 0, 0);
                const sel = this.regionNatural;
                const rw = sel.x2 - sel.x1;
                const rh = sel.y2 - sel.y1;
                // 파란 점선 테두리
                ctx.strokeStyle = 'rgba(37, 99, 235, 0.85)';
                ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.004);
                ctx.setLineDash([Math.max(6, w * 0.01), Math.max(4, Math.min(w, h) * 0.008)]);
                ctx.strokeRect(sel.x1, sel.y1, rw, rh);
                // 어두운 그림자 테두리
                ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
                ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.002);
                ctx.strokeRect(sel.x1, sel.y1, rw, rh);
                const dataUrl = canvas.toDataURL('image/png');
                const base64 = dataUrl.split(',')[1];
                return { base64, mimeType: 'image/png' };
            } catch (err) {
                console.warn('[SlideViewer] overlay build failed:', err);
                return null;
            }
        },
        cancelEdit() {
            this.editDialog = false;
            document.body.style.overflow = '';
            if (this.editResultUrl && this.editResultUrl.startsWith('blob:')) {
                URL.revokeObjectURL(this.editResultUrl);
            }
        },
        async submitEdit() {
            if (!this.editInstruction.trim()) return;
            this.editStep = 'loading';
            try {
                // 오버레이 이미지 빌드 (영역 선택 시)
                const overlay = await this.buildOverlayImage();
                const body = {
                    image_url: this.editOriginalUrl,
                    instruction: this.editInstruction.trim()
                };
                if (this.regionNatural) {
                    body.selection = this.regionNatural;
                }
                if (overlay) {
                    body.annotated_image_base64 = overlay.base64;
                    body.annotated_image_mime_type = overlay.mimeType;
                }
                if (this.editRefImage) {
                    body.reference_image_base64 = this.editRefImage.base64;
                    body.reference_image_mime_type = this.editRefImage.mimeType;
                }
                const resp = await fetch('http://localhost:1192/api/edit-slide-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                if (!resp.ok) {
                    const err = await resp.json().catch(() => ({}));
                    throw new Error(err.error || `HTTP ${resp.status}`);
                }
                const data = await resp.json();
                // base64 → blob URL
                const binary = atob(data.image_base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const blob = new Blob([bytes], { type: data.mime_type || 'image/png' });
                this.editResultUrl = URL.createObjectURL(blob);
                this.editStep = 'compare';
            } catch (err) {
                this.editError = err.message || '알 수 없는 오류';
                this.editStep = 'error';
            }
        },
        applyEdit() {
            const slide = this.slides[this.currentIndex];
            if (slide) {
                slide.image = this.editResultUrl;
            }
            if (this.imageUrls && this.imageUrls[this.currentIndex] !== undefined) {
                this.imageUrls[this.currentIndex] = this.editResultUrl;
            }
            this.editDialog = false;
            document.body.style.overflow = '';
        },
        onImgError(e) {
            // 이미지 로드 실패 시 마크다운으로 폴백
            const idx = this.currentIndex;
            if (this.slides[idx]) {
                this.slides[idx].image = null;
            }
        }
    },
    watch: {
        slideMarkdown() {
            this.currentIndex = 0;
        },
        fullscreen(v) {
            if (v) {
                this.$nextTick(() => {
                    this.$refs.fullscreenEl?.focus();
                });
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        }
    },
    beforeUnmount() {
        document.body.style.overflow = '';
    }
};
</script>

<style scoped>
.slide-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #f5f5f7;
    user-select: none;
}

/* ── 슬라이드 스테이지 ── */
.slide-viewer__stage {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
    touch-action: pan-y;
    cursor: grab;
    padding: 20px 24px 12px;
    min-height: 0;
    overflow: hidden;
}

.slide-viewer__card {
    width: 100%;
    max-width: 720px;
    aspect-ratio: 16 / 9;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 2px 16px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.04);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}

.slide-viewer__image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: 12px;
}

.slide-viewer__md {
    padding: 32px 36px;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    font-size: 14px;
    line-height: 1.7;
    color: #1d1d1f;
}

.slide-viewer__md :deep(h1) {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 12px;
    color: #1d1d1f;
}

.slide-viewer__md :deep(h2) {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 10px;
    color: #1d1d1f;
}

.slide-viewer__md :deep(h3) {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 8px;
    color: #333;
}

.slide-viewer__md :deep(ul),
.slide-viewer__md :deep(ol) {
    padding-left: 20px;
    margin-bottom: 8px;
}

.slide-viewer__md :deep(li) {
    margin-bottom: 4px;
}

.slide-viewer__md :deep(p) {
    margin-bottom: 8px;
}

.slide-viewer__md :deep(img) {
    max-width: 100%;
    border-radius: 8px;
    margin: 8px 0;
}

/* ── 컨트롤 바 ── */
.slide-viewer__controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 16px;
    flex-shrink: 0;
}

.slide-viewer__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.06);
    color: #333;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
}

.slide-viewer__btn:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.12);
}

.slide-viewer__btn:disabled {
    opacity: 0.3;
    cursor: default;
}

.slide-viewer__btn--expand {
    margin-left: 8px;
}

.slide-viewer__counter {
    font-size: 12px;
    font-weight: 500;
    color: #666;
    min-width: 48px;
    text-align: center;
    font-variant-numeric: tabular-nums;
}

/* ── 썸네일 스트립 ── */
.slide-viewer__strip {
    display: flex;
    gap: 6px;
    padding: 6px 16px 12px;
    overflow-x: auto;
    flex-shrink: 0;
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
}

.slide-viewer__strip::-webkit-scrollbar {
    height: 4px;
}

.slide-viewer__strip::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.15);
    border-radius: 2px;
}

.slide-viewer__thumb {
    flex-shrink: 0;
    width: 72px;
    height: 42px;
    border-radius: 6px;
    border: 2px solid transparent;
    background: #fff;
    overflow: hidden;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.slide-viewer__thumb:hover {
    border-color: rgba(var(--v-theme-primary), 0.4);
}

.slide-viewer__thumb.is-active {
    border-color: rgb(var(--v-theme-primary));
    box-shadow: 0 0 0 1px rgb(var(--v-theme-primary)), 0 1px 4px rgba(0, 0, 0, 0.12);
}

.slide-viewer__thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.slide-viewer__thumb-text {
    font-size: 8px;
    color: #888;
    text-align: center;
    padding: 2px;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

/* ── 스와이프 트랜지션 ── */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.28s ease;
    position: absolute;
    width: 100%;
    max-width: 720px;
}

.slide-left-enter-from {
    transform: translateX(60%);
    opacity: 0;
}
.slide-left-leave-to {
    transform: translateX(-60%);
    opacity: 0;
}

.slide-right-enter-from {
    transform: translateX(-60%);
    opacity: 0;
}
.slide-right-leave-to {
    transform: translateX(60%);
    opacity: 0;
}

/* ── 풀스크린 오버레이 ── */
.slide-fullscreen {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.88);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    outline: none;
    backdrop-filter: blur(8px);
}

.slide-fullscreen__stage {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    overflow: hidden;
    position: relative;
    touch-action: pan-y;
    cursor: grab;
    padding: 40px 60px 16px;
    min-height: 0;
}

.slide-fullscreen__card {
    width: 100%;
    max-width: 1100px;
    aspect-ratio: 16 / 9;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 8px 48px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
}

.slide-fullscreen__image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: 16px;
}

.slide-fullscreen__md {
    padding: 48px 56px;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    font-size: 20px;
    line-height: 1.8;
    color: #1d1d1f;
}

.slide-fullscreen__md :deep(h1) {
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 16px;
}
.slide-fullscreen__md :deep(h2) {
    font-size: 26px;
    font-weight: 600;
    margin-bottom: 12px;
}
.slide-fullscreen__md :deep(h3) {
    font-size: 21px;
    font-weight: 600;
    margin-bottom: 10px;
}
.slide-fullscreen__md :deep(ul),
.slide-fullscreen__md :deep(ol) {
    padding-left: 28px;
    margin-bottom: 12px;
}
.slide-fullscreen__md :deep(li) {
    margin-bottom: 6px;
}
.slide-fullscreen__md :deep(img) {
    max-width: 100%;
    border-radius: 12px;
}

.slide-fullscreen__controls {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 0 28px;
    flex-shrink: 0;
}

.slide-fullscreen__controls .slide-viewer__btn {
    width: 40px;
    height: 40px;
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
    border-radius: 10px;
}

.slide-fullscreen__controls .slide-viewer__btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.22);
}

.slide-fullscreen__counter {
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    min-width: 56px;
    text-align: center;
    font-variant-numeric: tabular-nums;
}

.slide-fullscreen__close {
    position: absolute;
    top: 16px;
    right: 20px;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
}

.slide-fullscreen__close:hover {
    background: rgba(255, 255, 255, 0.25);
}

/* fade transition for fullscreen overlay */
.fade-enter-active {
    transition: opacity 0.2s ease;
}
.fade-leave-active {
    transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

/* ── 편집 모달 ── */
.slide-edit {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    outline: none;
    flex-direction: column;
}

.slide-edit::before {
    content: '';
    position: absolute;
    width: min(1100px, 92vw);
    height: min(760px, 88vh);
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 12px 60px rgba(0, 0, 0, 0.25);
    pointer-events: none;
}

.slide-edit > * {
    position: relative;
    z-index: 1;
    width: min(1100px, 92vw);
}

.slide-edit__topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 16px 16px 0 0;
}

.slide-edit__title {
    font-size: 15px;
    font-weight: 600;
    color: #1d1d1f;
}

.slide-edit__topbar-right {
    display: flex;
    align-items: center;
    gap: 12px;
}

.slide-edit__close {
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 6px;
    border-radius: 50%;
    transition: background 0.15s;
}

.slide-edit__close :deep(.v-icon) {
    color: #666 !important;
}

.slide-edit__close:hover {
    background: rgba(0, 0, 0, 0.06);
}

/* 수정 전/후 토글 */
.slide-edit__toggle {
    display: flex;
    background: rgba(0, 0, 0, 0.06);
    border-radius: 8px;
    padding: 3px;
}

.slide-edit__toggle-btn {
    padding: 5px 16px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.4);
    background: transparent;
    cursor: pointer;
    transition: all 0.15s;
}

.slide-edit__toggle-btn.is-active {
    color: #1d1d1f;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.slide-edit__toggle-btn:hover:not(.is-active) {
    color: rgba(0, 0, 0, 0.6);
}

/* 바디 */
.slide-edit__body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    max-height: calc(min(760px, 88vh) - 52px);
}

/* 이미지 영역 */
.slide-edit__image-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px 32px;
    min-height: 0;
    position: relative;
    background: #f5f5f7;
}

.slide-edit__img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 10px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.slide-edit__img--dimmed {
    opacity: 0.3;
    filter: blur(2px);
}

/* 로딩 오버레이 (이미지 위) */
.slide-edit__loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.4);
}

.slide-edit__loading-text {
    margin-top: 16px;
    font-size: 14px;
    color: #555;
}

/* 하단 입력바 */
.slide-edit__input-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 32px 14px;
    flex-shrink: 0;
}

.slide-edit__input {
    flex: 1;
    height: 38px;
    padding: 8px 14px;
    border: 1px solid #ddd;
    border-radius: 10px;
    background: #fff;
    color: #1d1d1f;
    font-size: 14px;
    line-height: 20px;
    font-family: inherit;
    resize: none;
    outline: none;
    overflow: hidden;
    transition: border-color 0.15s;
}

.slide-edit__input::placeholder {
    color: #aaa;
}

.slide-edit__input:focus {
    border-color: rgb(var(--v-theme-primary));
}

.slide-edit__send {
    width: 38px;
    height: 38px;
    border: none;
    border-radius: 10px;
    background: rgb(var(--v-theme-primary));
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: opacity 0.15s;
}

.slide-edit__send:disabled {
    opacity: 0.3;
    cursor: default;
}

.slide-edit__send:hover:not(:disabled) {
    opacity: 0.85;
}

/* 비교 모드 하단 액션 */
.slide-edit__compare-actions {
    display: flex;
    justify-content: center;
    gap: 10px;
    padding: 12px 32px 20px;
    flex-shrink: 0;
}

.slide-edit__action-btn {
    padding: 8px 20px;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    transition: background 0.15s;
}

.slide-edit__action-btn--ghost {
    background: #f0f0f0;
    color: #555;
}

.slide-edit__action-btn--ghost:hover {
    background: #e4e4e4;
    color: #333;
}

.slide-edit__action-btn--primary {
    background: rgb(var(--v-theme-primary));
    color: #fff;
}

.slide-edit__action-btn--primary:hover {
    opacity: 0.9;
}

/* 에러 */
.slide-edit__error-content {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.slide-edit__error-text {
    margin-top: 16px;
    font-size: 15px;
    color: #666;
}

/* 드래그 영역 선택 */
.slide-edit__canvas-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 100%;
    max-height: 100%;
    cursor: crosshair;
    user-select: none;
}

.slide-edit__canvas-wrap .slide-edit__img {
    pointer-events: none;
}

.slide-edit__region {
    position: absolute;
    border: 2.5px dashed rgba(59, 130, 246, 0.9);
    background: rgba(59, 130, 246, 0.08);
    box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.2);
    border-radius: 3px;
    pointer-events: none;
    z-index: 1;
}

.slide-edit__hint {
    position: absolute;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 12px;
    color: #999;
    white-space: nowrap;
    pointer-events: none;
}

/* 참조 이미지 */
.slide-edit__ref-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 32px 0;
    flex-shrink: 0;
}

.slide-edit__ref-thumb {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid #ddd;
}

.slide-edit__ref-label {
    font-size: 12px;
    color: #888;
}

.slide-edit__ref-remove {
    background: none;
    border: none;
    cursor: pointer;
    color: #aaa;
    display: flex;
    padding: 2px;
    border-radius: 50%;
}

.slide-edit__ref-remove:hover {
    background: rgba(0, 0, 0, 0.06);
    color: #666;
}

.slide-edit__attach {
    width: 38px;
    height: 38px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: #888;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
}

.slide-edit__attach:hover {
    background: rgba(0, 0, 0, 0.06);
    color: #555;
}

.slide-viewer__btn--edit {
    margin-left: 8px;
}
</style>

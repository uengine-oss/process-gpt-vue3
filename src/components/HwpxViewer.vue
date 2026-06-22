<template>
    <div class="hwpx-viewer">
        <div class="hwpx-viewer__header">
            <div class="hwpx-viewer__title">미리보기</div>
            <div class="hwpx-viewer__actions">
                <v-chip v-if="imgEnhancing" size="small" variant="tonal" color="primary" class="mr-2">
                    <v-progress-circular size="10" width="1" indeterminate class="mr-1" />
                    이미지 개선 중...
                </v-chip>
                <v-chip
                    v-if="editNotice.visible"
                    size="small"
                    variant="tonal"
                    :color="editNotice.type === 'error' ? 'error' : 'success'"
                    class="mr-2"
                >
                    {{ editNotice.text }}
                </v-chip>
                <!-- BPMN: 미리보기 / XML / JSON(편집) 3-탭 -->
                <div v-if="mode === 'bpmn'" class="hwpx-viewer__toggle mr-2">
                    <button :class="{ 'is-on': viewMode === 'preview' }" @click="viewMode = 'preview'">미리보기</button>
                    <button :class="{ 'is-on': viewMode === 'xml' }" @click="viewMode = 'xml'">XML</button>
                    <button :class="{ 'is-on': viewMode === 'json' }" @click="viewMode = 'json'">JSON</button>
                </div>
                <!-- md/html: 미리보기 / 코드(원본) 토글 -->
                <div v-else-if="canToggleCode" class="hwpx-viewer__toggle mr-2">
                    <button :class="{ 'is-on': viewMode === 'preview' }" @click="viewMode = 'preview'">미리보기</button>
                    <button :class="{ 'is-on': viewMode === 'code' }" @click="viewMode = 'code'">코드</button>
                </div>
                <v-btn
                    v-if="mode === 'html' && viewMode === 'preview' && !isLoading && !hasError && !readOnly"
                    variant="text"
                    density="comfortable"
                    size="small"
                    :color="sectionEditMode ? 'primary' : undefined"
                    :loading="aiEditing"
                    @click="onHtmlAiEdit"
                >
                    <v-icon size="16" class="mr-1">mdi-robot-outline</v-icon>
                    AI 편집
                </v-btn>
                <!-- HWP(htmlUrl) 전용 WYSIWYG 편집 — 작업폴더 html 은 아래 '편집'(코드탭)으로 처리 -->
                <v-btn v-if="mode === 'html' && htmlUrl && viewMode === 'preview' && isEditing && !readOnly" variant="text" density="comfortable" size="small" @click="cancelEdit">
                    <v-icon size="16" class="mr-1">mdi-close</v-icon>
                    편집취소
                </v-btn>
                <v-btn
                    v-if="mode === 'html' && htmlUrl && viewMode === 'preview' && !isLoading && !hasError && !readOnly"
                    variant="text"
                    density="comfortable"
                    size="small"
                    @click="toggleEditMode"
                >
                    <v-icon size="16" class="mr-1">{{ isEditing ? 'mdi-check' : 'mdi-pencil-outline' }}</v-icon>
                    {{ isEditing ? '편집완료' : '편집' }}
                </v-btn>
                <!-- md/json/bpmn: html 과 동일하게 AI 편집 + 수동 편집(원본) 제공 -->
                <v-btn
                    v-if="mode !== 'html' && !readOnly"
                    variant="text"
                    density="comfortable"
                    size="small"
                    :loading="aiEditing"
                    @click="openAiEdit"
                >
                    <v-icon size="16" class="mr-1">mdi-robot-outline</v-icon>
                    AI 편집
                </v-btn>
                <!-- 일반 편집(코드탭): bpmn/md/json + 작업폴더 html(=htmlUrl 없음) -->
                <v-btn
                    v-if="((mode !== 'html' && (canToggleCode || mode === 'bpmn')) || (mode === 'html' && !htmlUrl)) && !readOnly"
                    variant="text"
                    density="comfortable"
                    size="small"
                    :color="(mode === 'bpmn' ? viewMode === 'json' : viewMode === 'code') ? 'primary' : undefined"
                    @click="onManualEdit"
                >
                    <v-icon size="16" class="mr-1">mdi-pencil-outline</v-icon>
                    편집
                </v-btn>
                <v-btn v-if="!isLoading && !hasError" variant="text" density="comfortable" size="small" @click="emitDownload">
                    <v-icon size="16" class="mr-1">mdi-download</v-icon>
                    다운로드
                </v-btn>
                <v-btn icon variant="text" density="comfortable" size="small" @click="$emit('close')">
                    <v-icon size="18">mdi-close</v-icon>
                </v-btn>
            </div>
        </div>
        <div class="hwpx-viewer__body">
            <!-- 코드(원본) 보기 — 토글로 켜면 md/html/bpmn 의 원본 텍스트 표시. 편집 가능하면 textarea. -->
            <textarea
                v-if="viewMode === 'code' && canToggleCode && codeEditable"
                class="hwpx-viewer__code-edit"
                v-model="localContent"
                spellcheck="false"
                @input="onCodeEdit"
            ></textarea>
            <pre v-else-if="viewMode === 'code' && canToggleCode" class="hwpx-viewer__code"><code>{{ prettySource }}</code></pre>
            <!-- 확장자별 동적 뷰어 (공통). html/hwpx/docx 는 기존 HTML 렌더, 그 외는 ext 별 분기. -->
            <!-- Markdown -->
            <div v-else-if="mode === 'markdown'" class="hwpx-viewer__content">
                <div class="hwpx-viewer__md" v-html="renderedMarkdown"></div>
            </div>
            <!-- JSON / 코드 -->
            <textarea
                v-else-if="mode === 'code' && codeEditable"
                class="hwpx-viewer__code-edit"
                v-model="localContent"
                spellcheck="false"
                @input="onCodeEdit"
            ></textarea>
            <pre v-else-if="mode === 'code'" class="hwpx-viewer__code"><code>{{ prettySource }}</code></pre>
            <!-- BPMN: JSON(편집) — 이 JSON 을 고치면 XML/다이어그램이 자동 갱신된다 -->
            <textarea
                v-else-if="mode === 'bpmn' && viewMode === 'json' && !readOnly"
                class="hwpx-viewer__code-edit"
                v-model="localJson"
                spellcheck="false"
                @input="onJsonEdit"
            ></textarea>
            <pre v-else-if="mode === 'bpmn' && viewMode === 'json'" class="hwpx-viewer__code"><code>{{ effectiveJson }}</code></pre>
            <!-- BPMN: XML(읽기) -->
            <pre v-else-if="mode === 'bpmn' && viewMode === 'xml'" class="hwpx-viewer__code"><code>{{ effectiveContent }}</code></pre>
            <!-- BPMN 다이어그램(미리보기) -->
            <div v-else-if="mode === 'bpmn'" class="hwpx-viewer__bpmn">
                <!-- 저장 결과 다이얼로그와 동일 컴포넌트/옵션 → 동일한 autolayout 레이아웃 -->
                <ProcessDefinition
                    v-if="effectiveContent"
                    :key="bpmnRenderKey"
                    :bpmn="effectiveContent"
                    isViewMode="true"
                    isAIGenerated="true"
                />
                <div v-else class="hwpx-viewer__state"><span class="text-caption">BPMN 내용이 없습니다.</span></div>
            </div>
            <!-- html 코드(원본) 편집 — viewMode==='code' 면 raw HTML textarea -->
            <textarea
                v-else-if="mode === 'html' && viewMode === 'code' && !readOnly"
                class="hwpx-viewer__code-edit"
                v-model="localContent"
                spellcheck="false"
                @input="onCodeEdit"
            ></textarea>
            <!-- ProcessGPT 폼 미리보기 — 커스텀 컴포넌트(<text-field> 등)는 DynamicForm 으로 렌더 -->
            <div
                v-else-if="mode === 'html' && isProcessGptForm"
                class="hwpx-viewer__content hwpx-viewer__form"
            >
                <DynamicForm :formHTML="effectiveContent" :readonly="true" />
            </div>
            <!-- HTML(기존 HWP/DOCX 흐름): url fetch 또는 content -->
            <template v-else>
                <div v-if="isLoading" class="hwpx-viewer__state">
                    <v-progress-circular indeterminate color="primary" :size="22" />
                    <span class="text-caption ml-2">문서를 불러오는 중...</span>
                </div>
                <div v-else-if="hasError" class="hwpx-viewer__state hwpx-viewer__state--error">
                    <v-icon size="18" color="error">mdi-alert-circle-outline</v-icon>
                    <span class="text-caption ml-2">문서를 불러올 수 없습니다.</span>
                </div>
                <div v-else class="hwpx-viewer__content" ref="content" @scroll="onContentScroll">
                    <div
                        ref="editor"
                        class="hwpx-viewer__html"
                        :class="{ 'is-editing': isEditing, 'section-edit-mode': sectionEditMode }"
                        :contenteditable="isEditing"
                        v-html="bodyHtml"
                        @click="handleSectionClick"
                        @mousedown="startSectionSelection"
                        @mouseover="onEditorImgOver"
                        @mouseleave="onEditorImgLeave"
                    ></div>
                    <div v-if="selectionRect.visible" class="hwpx-selection-rect" :style="selectionRectStyle"></div>
                </div>
            </template>
        </div>

        <!-- 이미지 AI 개선 플로팅 버튼 -->
        <div
            v-if="imgOverlayVisible && isEditing && imgHoverRect"
            ref="imgOverlayBtn"
            class="img-enhance-overlay"
            :style="{
                top: imgHoverRect.top + 4 + 'px',
                left: imgHoverRect.left + imgHoverRect.width - 84 + 'px'
            }"
            @mouseenter="imgMouseInOverlay = true"
            @mouseleave="onOverlayMouseLeave"
        >
            <v-btn size="x-small" color="primary" variant="flat" rounded :disabled="imgEnhancing" @click.stop="clickEnhanceImage">
                <v-icon size="13" class="mr-1">mdi-creation</v-icon>
                AI 개선
            </v-btn>
        </div>

        <!-- 이미지 이전/이후 비교 다이얼로그 -->
        <v-dialog v-model="imgEnhanceDialog" max-width="820" persistent>
            <v-card>
                <v-card-title class="d-flex align-center pa-4 pb-2">
                    <v-icon class="mr-2" color="primary" size="20">mdi-creation</v-icon>
                    AI 이미지 개선 결과
                    <v-spacer />
                    <v-btn icon variant="text" size="small" @click="cancelEnhance">
                        <v-icon size="18">mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="pa-4 pt-2">
                    <div class="text-caption text-medium-emphasis mb-3">이미지를 드래그하면 이전/이후를 비교할 수 있습니다.</div>
                    <div
                        class="img-compare"
                        ref="compareRef"
                        @mousemove="onCompareMouse"
                        @mousedown.prevent="compareDragging = true"
                        @mouseup="compareDragging = false"
                        @mouseleave="compareDragging = false"
                    >
                        <!-- 이후 이미지 (기준, 전체 크기) -->
                        <img :src="imgEnhancedSrc" class="img-compare__after" alt="이후" />
                        <!-- 이전 이미지 (클립으로 덮어씌움) -->
                        <img
                            v-if="imgEnhanceOriginalSrc"
                            :src="imgEnhanceOriginalSrc"
                            class="img-compare__before"
                            :style="{ clipPath: `inset(0 ${100 - imgComparePos}% 0 0)` }"
                            alt="이전"
                        />
                        <!-- 구분선 -->
                        <div class="img-compare__divider" :style="{ left: imgComparePos + '%' }">
                            <div class="img-compare__handle">
                                <v-icon size="13" color="grey-darken-2">mdi-unfold-more-horizontal</v-icon>
                            </div>
                        </div>
                        <!-- 라벨 -->
                        <span class="img-compare__lbl img-compare__lbl--l">이전</span>
                        <span class="img-compare__lbl img-compare__lbl--r">이후</span>
                    </div>
                    <!-- 슬라이더 보조 -->
                    <v-slider
                        v-model="imgComparePos"
                        :min="2"
                        :max="98"
                        :step="1"
                        hide-details
                        class="mt-3"
                        color="primary"
                        density="compact"
                    />
                </v-card-text>
                <v-card-actions class="pa-4 pt-0">
                    <v-spacer />
                    <v-btn variant="text" @click="cancelEnhance">취소</v-btn>
                    <v-btn color="primary" variant="flat" rounded @click="confirmEnhance">
                        <v-icon size="16" class="mr-1">mdi-check</v-icon>
                        이 이미지로 교체
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="sectionEditDialog" max-width="520" persistent>
            <v-card class="pa-2" style="border-radius: 16px">
                <v-card-title class="d-flex align-center pa-3 pb-1">
                    <div class="text-subtitle-1 font-weight-bold">AI 편집</div>
                    <v-spacer></v-spacer>
                    <v-btn icon variant="text" @click="cancelSectionEdit">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="pa-3 pt-2">
                    <div class="text-caption text-medium-emphasis mb-2">{{ sectionEditPageNumber }}페이지 선택됨</div>
                    <div v-if="sectionEditTargetText" class="text-caption mb-1">선택 내용: "{{ sectionEditTargetText }}"</div>
                    <div v-if="selectedTargets.length > 1" class="text-caption text-medium-emphasis mb-3">
                        총 {{ selectedTargets.length }}개 영역 선택
                    </div>
                    <v-textarea
                        v-model="sectionEditInstruction"
                        label="수정 지시사항"
                        rows="3"
                        density="compact"
                        variant="outlined"
                        :error="!!sectionEditError"
                        :error-messages="sectionEditError"
                        hide-details="auto"
                        autofocus
                    />
                </v-card-text>
                <v-card-actions class="pa-3 pt-0">
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="cancelSectionEdit">취소</v-btn>
                    <v-btn color="primary" variant="flat" rounded @click="confirmSectionEdit">요청</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- md/json/bpmn AI 편집 — 지시문 입력(HWP AI편집과 동일 UX) -->
        <v-dialog v-model="aiEditDialog" max-width="520" persistent>
            <v-card class="pa-2" style="border-radius: 16px">
                <v-card-title class="d-flex align-center pa-3 pb-1">
                    <v-icon class="mr-2" color="primary" size="20">mdi-robot-outline</v-icon>
                    <div class="text-subtitle-1 font-weight-bold">AI 편집</div>
                    <v-spacer />
                    <v-btn icon variant="text" @click="aiEditDialog = false"><v-icon>mdi-close</v-icon></v-btn>
                </v-card-title>
                <v-card-text class="pa-3 pt-2">
                    <div class="text-caption text-medium-emphasis mb-2">이 파일 내용을 어떻게 수정할지 지시해 주세요.</div>
                    <v-textarea
                        v-model="aiEditInstruction"
                        label="수정 지시사항"
                        rows="3"
                        density="compact"
                        variant="outlined"
                        hide-details="auto"
                        autofocus
                    />
                </v-card-text>
                <v-card-actions class="pa-3 pt-0">
                    <v-spacer />
                    <v-btn variant="text" @click="aiEditDialog = false">취소</v-btn>
                    <v-btn color="primary" variant="flat" rounded :disabled="!aiEditInstruction.trim()" @click="confirmAiEdit">요청</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 출처(참고자료) 호버 툴팁 -->
        <div
            v-if="sourceTooltip.visible"
            class="hwpx-source-tooltip"
            :style="{ top: sourceTooltip.top + 'px', left: sourceTooltip.left + 'px' }"
            @mouseenter="sourceTooltip.hovering = true"
            @mouseleave="hideSourceTooltip(true)"
        >
            <div class="hwpx-source-tooltip__header">
                <v-icon size="14" class="mr-1" color="success">mdi-book-open-variant</v-icon>
                참고 출처 {{ sourceTooltip.sources.length }}개
            </div>
            <div
                v-for="(src, i) in sourceTooltip.sources"
                :key="i"
                class="hwpx-source-tooltip__item"
            >
                <div class="hwpx-source-tooltip__file">
                    <span class="hwpx-source-tooltip__file-name">{{ src.file_name || src.title || '내부 문서' }}</span>
                    <span v-if="src.page != null" class="hwpx-source-tooltip__page">p.{{ src.page }}</span>
                </div>
                <div v-if="src.section_title" class="hwpx-source-tooltip__section">
                    <v-icon size="11" class="mr-1">mdi-bookmark-outline</v-icon>
                    {{ src.section_title }}
                </div>
                <!-- PDF 하이라이트 썸네일 — 백엔드가 문서 생성 시 미리 렌더링한 URL을 그대로 사용 -->
                <div
                    v-if="src.preview_url"
                    class="hwpx-source-tooltip__thumb-wrap"
                    @click.stop="openHighlightModal(src)"
                >
                    <img
                        :src="src.preview_url"
                        class="hwpx-source-tooltip__thumb"
                        alt="원본 페이지 미리보기"
                        title="클릭하면 크게 보기"
                        loading="lazy"
                    />
                </div>
                <div v-if="src.snippet" class="hwpx-source-tooltip__snippet">{{ src.snippet }}</div>
                <a
                    v-if="src.url"
                    :href="src.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="hwpx-source-tooltip__link"
                    @click.stop
                >원본 열기 <v-icon size="11">mdi-open-in-new</v-icon></a>
            </div>
        </div>

        <!-- PDF 하이라이트 Full-size 모달 -->
        <v-dialog v-model="highlightModal.visible" max-width="1100">
            <v-card class="hwpx-highlight-modal">
                <v-card-title class="d-flex align-center pa-3 pb-2">
                    <v-icon class="mr-2" color="success" size="18">mdi-book-open-page-variant</v-icon>
                    <div class="flex-1">
                        <div class="text-body-1 font-weight-bold">{{ highlightModal.fileName }}</div>
                        <div v-if="highlightModal.pageLabel" class="text-caption text-medium-emphasis">{{ highlightModal.pageLabel }}</div>
                    </div>
                    <v-btn icon variant="text" size="small" @click="closeHighlightModal">
                        <v-icon size="18">mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="pa-3 pt-0 text-center">
                    <img
                        v-if="highlightModal.url"
                        :src="highlightModal.url"
                        class="hwpx-highlight-modal__img"
                        alt="원본 페이지 하이라이트"
                    />
                </v-card-text>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import { marked } from 'marked';
import { defineAsyncComponent } from 'vue';

export default {
    name: 'HwpxViewer',
    components: {
        // 저장 결과 다이얼로그와 '동일한' BPMN 미리보기를 쓰기 위해 ProcessDefinition(isViewMode+isAIGenerated)을 사용.
        ProcessDefinition: defineAsyncComponent(() => import('@/components/ProcessDefinition.vue')),
        // ProcessGPT 폼(<text-field> 등 커스텀 컴포넌트)은 v-html 로 안 되므로 DynamicForm 으로 렌더.
        DynamicForm: defineAsyncComponent(() => import('@/components/designer/DynamicForm.vue'))
    },
    props: {
        htmlUrl: { type: String, default: '' },
        readOnly: { type: Boolean, default: false },
        // 공통 뷰어 확장: URL 없이 내용을 직접 렌더할 때 사용(확장자별 분기).
        content: { type: String, default: '' },
        ext: { type: String, default: '' },
        // BPMN 전용: 연결된 process-definition.json 내용(JSON 탭/편집/AI편집 대상). 편집 시 XML/다이어그램은 부모가 재파생.
        defJson: { type: String, default: '' }
    },
    data() {
        return {
            viewMode: 'preview', // 'preview' | 'code'(md/html) | 'xml' | 'json'(bpmn)
            localContent: '', // 편집 가능한 로컬 본문(코드/원본 편집 시 사용)
            localJson: '', // BPMN JSON 편집본(process-definition)
            aiEditDialog: false,
            aiEditInstruction: '',
            aiEditing: false,
            isLoading: true,
            hasError: false,
            loadTimer: null,
            bodyHtml: '',
            originalHtml: '',
            styleText: '',
            styleElement: null,
            isEditing: false,
            sectionEditMode: false,
            sectionEditDialog: false,
            sectionEditPageNumber: 0,
            sectionEditTargetText: '',
            sectionEditInstruction: '',
            sectionEditError: '',
            selectedTargets: [],
            selectionActive: false,
            selectionStartX: 0,
            selectionStartY: 0,
            selectionRect: {
                left: 0,
                top: 0,
                width: 0,
                height: 0,
                visible: false
            },
            editNotice: {
                visible: false,
                text: '',
                type: 'success'
            },
            editNoticeTimer: null,
            editHighlightTimers: [],
            // 이미지 AI 개선
            imgHoverRect: null,
            imgOverlayVisible: false,
            imgMouseInOverlay: false,
            imgEnhanceTargetEl: null,
            imgEnhancing: false,
            imgEnhanceDialog: false,
            imgEnhanceOriginalSrc: '',
            imgEnhancedSrc: '',
            imgComparePos: 50,
            imgEnhanceError: '',
            compareDragging: false,
            // 출처 hover 툴팁
            sourceTooltip: {
                visible: false,
                sources: [],
                top: 0,
                left: 0,
                targetEl: null,
                hovering: false
            },
            sourceTooltipHideTimer: null,
            // PDF 하이라이트 full-size 모달 (썸네일/모달 둘 다 백엔드가 preview_url을 미리 박아둠)
            highlightModal: {
                visible: false,
                url: '',
                fileName: '',
                pageLabel: ''
            }
        };
    },
    computed: {
        selectionRectStyle() {
            return {
                left: `${this.selectionRect.left}px`,
                top: `${this.selectionRect.top}px`,
                width: `${this.selectionRect.width}px`,
                height: `${this.selectionRect.height}px`
            };
        },
        /** 확장자 → 뷰어 모드. html/hwpx/docx=HTML, md=markdown, json/기타텍스트=code, bpmn/xml=BPMN. */
        mode() {
            const e = (this.ext || '').toString().toLowerCase().replace(/^\./, '');
            if (e === 'md' || e === 'markdown') return 'markdown';
            if (e === 'json') return 'code';
            if (e === 'bpmn') return 'bpmn';
            if (e === 'html' || e === 'htm' || e === 'hwpx' || e === 'docx' || e === '') return 'html';
            // yaml/yml/txt/xml/csv/dmn 등 → 코드로
            return 'code';
        },
        /** 미리보기↔원본 토글을 보여줄 모드(md/html/bpmn). json/코드는 이미 원본이라 토글 불필요. */
        canToggleCode() {
            return this.mode === 'markdown' || this.mode === 'html' || this.mode === 'bpmn';
        },
        /** 미리보기·렌더에 쓰는 본문 — 편집 중이면 편집본(localContent), 아니면 원본 content. */
        effectiveContent() {
            return this.localContent != null && this.localContent !== '' ? this.localContent : (this.content || '').toString();
        },
        /** BPMN JSON(process-definition) — 편집본 우선. */
        effectiveJson() {
            return this.localJson != null && this.localJson !== '' ? this.localJson : (this.defJson || '').toString();
        },
        /** ProcessGPT 폼(<*-field> + row 레이아웃)인지 — 맞으면 DynamicForm 으로 렌더해야 함. */
        isProcessGptForm() {
            const h = (this.effectiveContent || '').toLowerCase();
            return h.indexOf('-field') >= 0 && (h.indexOf("class='row'") >= 0 || h.indexOf('class="row"') >= 0 || h.indexOf('<section') >= 0);
        },
        /** 코드 영역을 편집 가능한 textarea 로 보여줄지(읽기전용 아니고 토글 가능 모드일 때). */
        codeEditable() {
            return !this.readOnly && (this.canToggleCode || this.mode === 'code');
        },
        /** BPMN 다이어그램 re-render 키(내용 변경 시 갱신). */
        bpmnRenderKey() {
            const s = (this.effectiveContent || '').toString();
            return `bpmn-${s.length}`;
        },
        renderedMarkdown() {
            const src = (this.effectiveContent || '').toString();
            try {
                return marked.parse(src, { breaks: true });
            } catch (e) {
                return `<pre>${src.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</pre>`;
            }
        },
        prettySource() {
            const src = (this.effectiveContent || '').toString();
            if ((this.ext || '').toLowerCase().replace(/^\./, '') === 'json') {
                try {
                    return JSON.stringify(JSON.parse(src), null, 2);
                } catch (e) {
                    return src;
                }
            }
            return src;
        }
    },
    watch: {
        // content 로 HTML 을 직접 받을 때(URL 없이) 파싱해 렌더.
        content: {
            immediate: true,
            handler() {
                const c = (this.content || '').toString();
                this.aiEditing = false; // 새 content 도착(AI 편집 결과 포함) → 로딩 해제
                // 우리가 emit 한 편집본이 되돌아온 경우(content===localContent)엔 리셋하지 않음(커서 튐 방지).
                if (c !== this.localContent) {
                    this.viewMode = 'preview'; // 새 파일 로드 시 미리보기부터
                    this.localContent = c; // 편집본 초기화
                }
                if (this.mode === 'html' && c && !this.htmlUrl) {
                    this.renderHtmlPreview(this.effectiveContent);
                }
            }
        },
        // 코드 편집 중 html 본문이 바뀌면 미리보기도 갱신.
        localContent() {
            if (this.mode === 'html' && !this.htmlUrl) {
                this.renderHtmlPreview(this.effectiveContent);
            }
        },
        defJson: {
            immediate: true,
            handler() {
                const j = (this.defJson || '').toString();
                this.aiEditing = false;
                if (j !== this.localJson) this.localJson = j; // 외부 변경(AI/재파생)만 반영
            }
        },
        htmlUrl: {
            immediate: true,
            handler() {
                if (!this.htmlUrl) {
                    // content 로 직접 렌더하는 경우엔 content 워처가 처리하므로 비우지 않는다.
                    if (this.content) {
                        this.isLoading = false;
                        return;
                    }
                    this.isLoading = false;
                    this.hasError = false;
                    this.bodyHtml = '';
                    this.styleText = '';
                    this.removeStyleTag();
                    this.isEditing = false;
                    if (this.loadTimer) clearTimeout(this.loadTimer);
                    this.loadTimer = null;
                    return;
                }
                this.isLoading = true;
                this.hasError = false;
                this.bodyHtml = '';
                this.styleText = '';
                this.removeStyleTag();
                this.isEditing = false;
                if (this.loadTimer) clearTimeout(this.loadTimer);
                this.loadTimer = setTimeout(() => {
                    if (this.isLoading) {
                        this.isLoading = false;
                        this.hasError = true;
                    }
                }, 12000);
                this.fetchHtml(this.htmlUrl);
            }
        }
    },
    methods: {
        renderHtmlPreview(src) {
            // content/localContent 의 HTML 을 파싱해 미리보기 본문에 반영.
            try {
                const parsed = this.parseHtml((src || '').toString());
                this.bodyHtml = parsed.bodyHtml;
                this.originalHtml = parsed.bodyHtml;
                this.styleText = parsed.styleText;
                this.injectStyleTag(parsed.styleText);
            } catch (e) {
                this.bodyHtml = (src || '').toString();
            }
            this.isLoading = false;
            this.hasError = false;
        },
        onCodeEdit() {
            // 코드/원본 편집 → 부모에 변경 내용 전달(저장 시 사용) + 미리보기 반영(effectiveContent).
            this.$emit('update:content', this.localContent);
        },
        openAiEdit() {
            this.aiEditInstruction = '';
            this.aiEditDialog = true;
        },
        /** html AI편집: HWP(htmlUrl)면 기존 섹션 편집, 작업폴더 파일이면 지시 다이얼로그. */
        onHtmlAiEdit() {
            if (this.htmlUrl) this.toggleSectionEditMode();
            else this.openAiEdit();
        },
        /** 수동 편집 버튼: bpmn 은 JSON 탭으로, 그 외는 코드 탭으로 이동. */
        onManualEdit() {
            if (this.mode === 'bpmn') {
                this.viewMode = this.viewMode === 'json' ? 'preview' : 'json';
            } else {
                this.viewMode = this.viewMode === 'code' ? 'preview' : 'code';
            }
        },
        onJsonEdit() {
            // BPMN JSON 편집 → 부모가 XML/다이어그램 재파생 + 저장 반영.
            this.$emit('update:def-json', this.localJson);
        },
        confirmAiEdit() {
            const instruction = (this.aiEditInstruction || '').trim();
            if (!instruction) return;
            this.aiEditDialog = false;
            this.aiEditing = true;
            // bpmn 은 JSON(process-definition)을 수정 대상으로 보낸다(편집 시 XML 자동 갱신).
            const isBpmn = this.mode === 'bpmn';
            this.$emit('ai-edit-request', {
                instruction,
                content: (isBpmn ? this.effectiveJson : this.effectiveContent || '').toString(),
                ext: isBpmn ? 'json' : (this.ext || '').toString(),
                target: isBpmn ? 'def-json' : 'content'
            });
            // 실패/무응답 시 로딩이 멈추지 않도록 안전 해제(성공 시엔 content 워처가 먼저 해제).
            if (this._aiEditTimer) clearTimeout(this._aiEditTimer);
            this._aiEditTimer = setTimeout(() => {
                this.aiEditing = false;
            }, 65_000);
        },
        /** 부모가 AI 편집 완료 후 호출(또는 content prop 변경)되면 로딩 해제. */
        aiEditDone() {
            this.aiEditing = false;
        },
        async fetchHtml(url) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const htmlText = await response.text();
                const parsed = this.parseHtml(htmlText);
                this.bodyHtml = parsed.bodyHtml;
                this.originalHtml = parsed.bodyHtml;
                this.styleText = parsed.styleText;
                this.injectStyleTag(parsed.styleText);
                this.isLoading = false;
                this.hasError = false;
            } catch (e) {
                this.isLoading = false;
                this.hasError = true;
                this.removeStyleTag();
            } finally {
                if (this.loadTimer) clearTimeout(this.loadTimer);
                this.loadTimer = null;
            }
        },
        toggleEditMode() {
            this.isEditing = !this.isEditing;
            if (!this.isEditing) {
                this.syncEditorHtml();
            } else {
                this.originalHtml = this.bodyHtml;
                this.$nextTick(() => {
                    try {
                        this.$refs.editor?.focus?.();
                    } catch (e) {}
                });
            }
        },
        toggleSectionEditMode() {
            if (this.isEditing) {
                this.toggleEditMode();
            }
            this.sectionEditMode = !this.sectionEditMode;
            if (!this.sectionEditMode) {
                this.resetSelectionState();
            }
        },
        cancelEdit() {
            this.isEditing = false;
            this.bodyHtml = this.originalHtml || this.bodyHtml;
            this.$nextTick(() => {
                try {
                    if (this.$refs.editor) {
                        this.$refs.editor.innerHTML = this.bodyHtml;
                    }
                } catch (e) {}
            });
        },
        handleSectionClick(event) {
            if (!this.sectionEditMode) return;
            if (this.selectionActive) return;
            if (!event?.target) return;
            const target = event.target.closest?.('[data-id]');
            if (!target) return;
            const dataId = (target.getAttribute('data-id') || '').toString().trim();
            if (!dataId) return;
            const pageEl = target.closest?.('.page');
            const root = this.$refs.editor;
            if (!pageEl || !root) return;
            const pages = Array.from(root.querySelectorAll('.page'));
            const pageIndex = pages.indexOf(pageEl);
            if (pageIndex < 0) return;
            const pageNumber = pageIndex + 1;
            const text = (target.textContent || '').toString().trim();
            this.openSectionEditDialog({
                pageNumber,
                targets: [{ id: dataId, text }]
            });
        },
        startSectionSelection(event) {
            if (!this.sectionEditMode) return;
            if (event?.button !== 0) return;
            if (this.isEditing) return;
            this.selectionActive = true;
            this.selectionStartX = event.clientX;
            this.selectionStartY = event.clientY;
            this.selectionRect = {
                left: event.clientX,
                top: event.clientY,
                width: 0,
                height: 0,
                visible: true
            };
            window.addEventListener('mousemove', this.onSectionSelectionMove);
            window.addEventListener('mouseup', this.endSectionSelection);
        },
        onSectionSelectionMove(event) {
            if (!this.selectionActive) return;
            const x1 = this.selectionStartX;
            const y1 = this.selectionStartY;
            const x2 = event.clientX;
            const y2 = event.clientY;
            const left = Math.min(x1, x2);
            const top = Math.min(y1, y2);
            const width = Math.abs(x2 - x1);
            const height = Math.abs(y2 - y1);
            this.selectionRect = {
                left,
                top,
                width,
                height,
                visible: true
            };
        },
        endSectionSelection() {
            if (!this.selectionActive) return;
            this.selectionActive = false;
            window.removeEventListener('mousemove', this.onSectionSelectionMove);
            window.removeEventListener('mouseup', this.endSectionSelection);
            const { width, height, left, top } = this.selectionRect;
            this.selectionRect.visible = false;
            if (width < 6 && height < 6) {
                return;
            }
            const editor = this.$refs.editor;
            if (!editor) return;
            const rectRight = left + width;
            const rectBottom = top + height;
            const candidates = Array.from(editor.querySelectorAll('[data-id]'));
            const selected = [];
            let firstPageEl = null;
            for (const el of candidates) {
                const id = (el.getAttribute('data-id') || '').toString().trim();
                if (!id) continue;
                const box = el.getBoundingClientRect();
                const intersects = box.right >= left && box.left <= rectRight && box.bottom >= top && box.top <= rectBottom;
                if (!intersects) continue;
                const pageEl = el.closest?.('.page');
                if (!firstPageEl && pageEl) firstPageEl = pageEl;
                if (firstPageEl && pageEl && pageEl !== firstPageEl) continue;
                const text = (el.textContent || '').toString().trim();
                selected.push({ id, text });
            }
            if (!selected.length || !firstPageEl) return;
            const pages = Array.from(editor.querySelectorAll('.page'));
            const pageIndex = pages.indexOf(firstPageEl);
            if (pageIndex < 0) return;
            const pageNumber = pageIndex + 1;
            this.openSectionEditDialog({ pageNumber, targets: selected });
        },
        resetSelectionState() {
            this.selectionActive = false;
            this.selectionRect = { left: 0, top: 0, width: 0, height: 0, visible: false };
            this.selectedTargets = [];
        },
        openSectionEditDialog({ pageNumber, targets }) {
            const list = Array.isArray(targets) ? targets : [];
            this.selectedTargets = list;
            const texts = list.map((t) => (t?.text || '').toString().trim()).filter(Boolean);
            let preview = texts.slice(0, 3).join(' / ');
            if (texts.length > 3) preview += ` 외 ${texts.length - 3}건`;
            this.sectionEditPageNumber = pageNumber;
            this.sectionEditTargetText = preview;
            this.sectionEditInstruction = '';
            this.sectionEditError = '';
            this.sectionEditDialog = true;
        },
        cancelSectionEdit() {
            this.sectionEditDialog = false;
            this.sectionEditPageNumber = 0;
            this.sectionEditTargetText = '';
            this.sectionEditInstruction = '';
            this.sectionEditError = '';
            this.selectedTargets = [];
        },
        confirmSectionEdit() {
            const instruction = (this.sectionEditInstruction || '').toString().trim();
            if (!instruction) {
                this.sectionEditError = '수정 지시사항을 입력해주세요.';
                return;
            }
            const contextLines = this.selectedTargets
                .map((t) => {
                    const id = (t?.id || '').toString().trim();
                    const text = (t?.text || '').toString().trim();
                    if (!id || !text) return '';
                    return `id=${id}: ${text}`;
                })
                .filter(Boolean)
                .slice(0, 8);
            const contextText = contextLines.join('\n');
            const payload = {
                pageNumber: this.sectionEditPageNumber,
                instruction,
                contextText
            };
            this.sectionEditDialog = false;
            this.sectionEditPageNumber = 0;
            this.sectionEditTargetText = '';
            this.sectionEditInstruction = '';
            this.sectionEditError = '';
            this.selectedTargets = [];
            this.$emit('page-edit-request', payload);
        },
        showEditNotice(text, type = 'success') {
            const msg = (text || '').toString().trim();
            if (!msg) return;
            this.editNotice = {
                visible: true,
                text: msg,
                type: type === 'error' ? 'error' : 'success'
            };
            if (this.editNoticeTimer) clearTimeout(this.editNoticeTimer);
            this.editNoticeTimer = setTimeout(() => {
                this.editNotice.visible = false;
            }, 2500);
        },
        highlightEdits(ids, pageNumber = 0) {
            const list = Array.isArray(ids) ? ids.map((x) => (x ?? '').toString()).filter(Boolean) : [];
            if (list.length === 0) return;
            const run = () => {
                const root = this.$refs.editor;
                if (!root) return;
                let scope = root;
                if (pageNumber) {
                    const pages = Array.from(root.querySelectorAll('.page'));
                    const page = pages[Number(pageNumber) - 1];
                    if (page) scope = page;
                }
                const targets = [];
                list.forEach((id) => {
                    const el = scope.querySelector(`[data-id="${id}"]`);
                    if (el) targets.push(el);
                });
                if (targets.length === 0) return;
                targets.forEach((el) => el.classList.add('hwpx-edit-highlight'));
                const timer = setTimeout(() => {
                    targets.forEach((el) => el.classList.remove('hwpx-edit-highlight'));
                }, 2000);
                this.editHighlightTimers.push(timer);
            };
            this.$nextTick(() => {
                setTimeout(run, 0);
            });
        },
        syncEditorHtml() {
            try {
                const html = this.$refs.editor?.innerHTML || '';
                if (html) this.bodyHtml = html;
                // WYSIWYG(편집) 내용도 부모로 전달해 저장에 반영(.hwpx-doc 래퍼 안쪽만 추출).
                let inner = html;
                try {
                    const tmp = document.createElement('div');
                    tmp.innerHTML = html;
                    const doc = tmp.querySelector('.hwpx-doc');
                    if (doc) inner = doc.innerHTML;
                } catch (e) {}
                if (inner) {
                    this.localContent = inner;
                    this.$emit('update:content', inner);
                }
            } catch (e) {}
        },

        // ──── 이미지 AI 개선 ────────────────────────────────────────────
        onContentScroll() {
            this.imgOverlayVisible = false;
            this.imgHoverRect = null;
            this.imgEnhanceTargetEl = null;
        },
        onEditorImgOver(e) {
            if (!this.isEditing) return;
            // 개선 진행 중이거나 결과 다이얼로그가 열려 있으면 타겟을 건드리지 않음
            if (this.imgEnhancing || this.imgEnhanceDialog) return;
            const img = e.target instanceof HTMLImageElement ? e.target : null;
            if (img && img.src) {
                this.imgEnhanceTargetEl = img;
                const rect = img.getBoundingClientRect();
                this.imgHoverRect = {
                    top: rect.top,
                    left: rect.left,
                    right: rect.right,
                    width: rect.width,
                    height: rect.height
                };
                this.imgOverlayVisible = true;
            } else if (!this.imgMouseInOverlay) {
                this.imgOverlayVisible = false;
                this.imgHoverRect = null;
                this.imgEnhanceTargetEl = null;
            }
        },
        onEditorImgLeave(e) {
            if (!this.isEditing) return;
            if (this.imgEnhancing || this.imgEnhanceDialog) return;
            const related = e.relatedTarget;
            if (
                related &&
                this.$refs.imgOverlayBtn &&
                (related === this.$refs.imgOverlayBtn || this.$refs.imgOverlayBtn.contains(related))
            ) {
                return;
            }
            if (!this.imgMouseInOverlay) {
                this.imgOverlayVisible = false;
                this.imgHoverRect = null;
                this.imgEnhanceTargetEl = null;
            }
        },
        onOverlayMouseLeave(e) {
            if (this.imgEnhanceDialog) return;
            this.imgMouseInOverlay = false;
            const related = e.relatedTarget;
            if (related && this.$refs.editor && this.$refs.editor.contains(related)) return;
            this.imgOverlayVisible = false;
            this.imgHoverRect = null;
            this.imgEnhanceTargetEl = null;
        },
        async clickEnhanceImage() {
            if (!this.imgEnhanceTargetEl || this.imgEnhancing) return;
            const img = this.imgEnhanceTargetEl;
            const src = img.src || '';
            if (!src) return;

            this.imgEnhancing = true;
            this.imgEnhanceError = '';
            this.imgEnhanceOriginalSrc = src;
            this.imgEnhancedSrc = '';
            this.imgComparePos = 50;
            this.imgOverlayVisible = false;

            try {
                let b64 = '';
                let mime = 'image/png';
                if (src.startsWith('data:')) {
                    const comma = src.indexOf(',');
                    b64 = src.slice(comma + 1);
                    mime = src.slice(5, src.indexOf(';')) || 'image/png';
                } else {
                    const resp = await fetch(src);
                    const blob = await resp.blob();
                    b64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result.split(',')[1]);
                        reader.readAsDataURL(blob);
                    });
                    mime = blob.type || 'image/png';
                }

                const resp = await fetch('http://localhost:1192/api/enhance-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image_base64: b64, mime_type: mime })
                });
                if (!resp.ok) {
                    const err = await resp.json().catch(() => ({}));
                    throw new Error(err.error || `HTTP ${resp.status}`);
                }
                const data = await resp.json();
                this.imgEnhancedSrc = `data:${data.mime_type || 'image/png'};base64,${data.image_base64}`;
                this.imgEnhanceDialog = true;
            } catch (err) {
                this.imgEnhanceError = err.message || '이미지 개선 실패';
                this.showEditNotice('이미지 개선 실패: ' + this.imgEnhanceError, 'error');
            } finally {
                this.imgEnhancing = false;
            }
        },
        confirmEnhance() {
            if (!this.imgEnhanceTargetEl || !this.imgEnhancedSrc) return;
            this.imgEnhanceTargetEl.src = this.imgEnhancedSrc;
            this.syncEditorHtml();
            this.showEditNotice('이미지가 개선되었습니다.', 'success');
            this.imgEnhanceDialog = false;
            this.imgEnhanceOriginalSrc = '';
            this.imgEnhancedSrc = '';
            this.imgEnhanceTargetEl = null;
            this.imgComparePos = 50;
        },
        cancelEnhance() {
            this.imgEnhanceDialog = false;
            this.imgEnhanceOriginalSrc = '';
            this.imgEnhancedSrc = '';
            this.imgEnhanceError = '';
            this.imgComparePos = 50;
        },
        onCompareMouse(e) {
            if (!this.compareDragging) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = ((e.clientX - rect.left) / rect.width) * 100;
            this.imgComparePos = Math.max(2, Math.min(98, pos));
        },
        // ────────────────────────────────────────────────────────────────

        applyPageEdit(pageNumber, pageHtml) {
            try {
                const current = this.bodyHtml || '';
                if (!current || !pageNumber || !pageHtml) return false;
                const parser = new DOMParser();
                const doc = parser.parseFromString(current, 'text/html');
                const pages = Array.from(doc.querySelectorAll('.page'));
                const idx = Math.max(0, Number(pageNumber) - 1);
                if (!pages[idx]) return false;
                const wrapper = document.createElement('div');
                wrapper.innerHTML = pageHtml;
                const newPage = wrapper.querySelector('.page');
                if (!newPage) return false;
                pages[idx].replaceWith(newPage);
                const updated = doc.body ? doc.body.innerHTML : current;
                this.bodyHtml = updated;
                this.originalHtml = updated;
                this.$nextTick(() => {
                    try {
                        if (this.$refs.editor) {
                            this.$refs.editor.innerHTML = this.bodyHtml;
                        }
                    } catch (e) {}
                });
                return true;
            } catch (e) {
                return false;
            }
        },
        applyPageEdits(pageNumber, edits) {
            try {
                const current = this.bodyHtml || '';
                if (!current || !pageNumber || !Array.isArray(edits)) return false;
                const parser = new DOMParser();
                const doc = parser.parseFromString(current, 'text/html');
                const pages = Array.from(doc.querySelectorAll('.page'));
                const idx = Math.max(0, Number(pageNumber) - 1);
                const page = pages[idx];
                if (!page) return false;
                const replaceText = (el, text) => {
                    const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
                    let first = null;
                    const toClear = [];
                    while (walker.nextNode()) {
                        if (!first) first = walker.currentNode;
                        else toClear.push(walker.currentNode);
                    }
                    if (!first) {
                        el.textContent = text;
                        return;
                    }
                    first.textContent = text;
                    toClear.forEach((node) => {
                        node.textContent = '';
                    });
                };
                edits.forEach((item) => {
                    if (!item || item.id === undefined) return;
                    const target = page.querySelector(`[data-id="${item.id}"]`);
                    if (!target) return;
                    replaceText(target, (item.new_text || '').toString());
                });
                const updated = doc.body ? doc.body.innerHTML : current;
                this.bodyHtml = updated;
                this.originalHtml = updated;
                this.$nextTick(() => {
                    try {
                        if (this.$refs.editor) {
                            this.$refs.editor.innerHTML = this.bodyHtml;
                        }
                    } catch (e) {}
                });
                return true;
            } catch (e) {
                return false;
            }
        },
        emitDownload() {
            try {
                if (this.isEditing) {
                    // 직접편집 모드: DOM의 실제 내용을 bodyHtml로 동기화 후 사용
                    this.syncEditorHtml();
                }
                // bodyHtml을 우선 사용 - applyPageEdits(AI편집)로 업데이트된 값을 보장
                // $refs.editor.innerHTML은 Vue의 v-html 반응성 업데이트 타이밍에 따라
                // 아직 갱신되지 않았을 수 있음
                const html = this.bodyHtml || this.$refs.editor?.innerHTML || '';
                this.$emit('download', { html });
            } catch (e) {
                this.$emit('download', { html: this.bodyHtml || '' });
            }
        },
        parseHtml(htmlText) {
            try {
                const styleMatches = htmlText.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
                const inlineStyles = styleMatches
                    .map((block) => block.replace(/<\/?style[^>]*>/gi, '').trim())
                    .filter(Boolean)
                    .join('\n');
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, 'text/html');
                const rawBodyHtml = doc.body ? doc.body.innerHTML : htmlText;
                const styles = Array.from(doc.querySelectorAll('style'))
                    .map((node) => node.textContent || '')
                    .filter(Boolean)
                    .join('\n');
                const bodyHtml = `<div class="hwpx-doc">${rawBodyHtml}</div>`;
                const mergedStyles = [styles, inlineStyles].filter(Boolean).join('\n');
                const scopedStyles = this.prefixCss(mergedStyles, '.hwpx-viewer__html') || mergedStyles;
                return { bodyHtml, styleText: scopedStyles };
            } catch (e) {
                const bodyHtml = `<div class="hwpx-doc">${htmlText}</div>`;
                return { bodyHtml, styleText: '' };
            }
        },
        prefixCss(cssText, scopeSelector) {
            if (!cssText || !scopeSelector) return cssText || '';
            const blocks = cssText.split('}');
            const scopedBlocks = blocks.map((block) => {
                const parts = block.split('{');
                if (parts.length < 2) return '';
                const selector = parts[0].trim();
                const body = parts.slice(1).join('{').trim();
                if (!selector || !body) return '';
                if (selector.startsWith('@')) {
                    return `${selector}{${body}}`;
                }
                const scopedSelector = selector
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((s) => {
                        const normalized = s.replace(/^html\s*/i, scopeSelector).replace(/^body\s*/i, scopeSelector);
                        if (normalized.startsWith(scopeSelector)) return normalized;
                        return `${scopeSelector} ${normalized}`;
                    })
                    .join(', ');
                return `${scopedSelector}{${body}}`;
            });
            return scopedBlocks.filter(Boolean).join('\n');
        },
        injectStyleTag(text) {
            if (!text) return;
            if (this.styleElement) {
                this.styleElement.textContent = text;
                return;
            }
            const el = document.createElement('style');
            el.setAttribute('data-hwpx-viewer', 'true');
            el.textContent = text;
            document.head.appendChild(el);
            this.styleElement = el;
        },
        removeStyleTag() {
            if (this.styleElement && this.styleElement.parentNode) {
                this.styleElement.parentNode.removeChild(this.styleElement);
            }
            this.styleElement = null;
        },
        // ──── 출처(참고자료) hover 툴팁 ────
        onSourceMouseOver(e) {
            const el = e.target && e.target.closest ? e.target.closest('[data-sources]') : null;
            if (!el) return;
            // 편집 모드에서는 편집 UX 우선
            if (this.isEditing || this.sectionEditMode) return;
            let sources;
            try {
                sources = JSON.parse(el.getAttribute('data-sources') || '[]');
            } catch (_err) {
                return;
            }
            if (!Array.isArray(sources) || sources.length === 0) return;
            if (this.sourceTooltipHideTimer) {
                clearTimeout(this.sourceTooltipHideTimer);
                this.sourceTooltipHideTimer = null;
            }
            const rect = el.getBoundingClientRect();
            // 툴팁은 대상 요소 오른쪽에 붙이되, 화면 밖으로 나가면 왼쪽으로 반전.
            const MAX_W = 360;
            let left = rect.right + 8;
            if (left + MAX_W > window.innerWidth - 12) {
                left = Math.max(12, rect.left - MAX_W - 8);
            }
            let top = rect.top;
            if (top + 40 > window.innerHeight) top = Math.max(12, window.innerHeight - 120);
            this.sourceTooltip = {
                visible: true,
                sources,
                top,
                left,
                targetEl: el,
                hovering: false
            };
        },
        onSourceMouseOut(e) {
            // mouseout은 자식으로 이동할 때도 발생하므로 관련 타겟이 현재 대상 안쪽이면 무시
            const toEl = e.relatedTarget;
            const targetEl = this.sourceTooltip.targetEl;
            if (!targetEl) return;
            if (toEl && (targetEl.contains(toEl) || toEl === targetEl)) return;
            this.hideSourceTooltip();
        },
        hideSourceTooltip(force) {
            if (force) {
                this.sourceTooltip.visible = false;
                this.sourceTooltip.hovering = false;
                this.sourceTooltip.targetEl = null;
                return;
            }
            // 툴팁 자체로 커서가 이동할 수 있도록 약간 지연
            if (this.sourceTooltipHideTimer) clearTimeout(this.sourceTooltipHideTimer);
            this.sourceTooltipHideTimer = setTimeout(() => {
                if (!this.sourceTooltip.hovering) {
                    this.sourceTooltip.visible = false;
                    this.sourceTooltip.targetEl = null;
                }
            }, 120);
        },
        attachSourceHoverListeners() {
            const host = this.$refs.editor;
            if (!host || this._sourceHoverAttached) return;
            this._boundSourceOver = this.onSourceMouseOver.bind(this);
            this._boundSourceOut = this.onSourceMouseOut.bind(this);
            host.addEventListener('mouseover', this._boundSourceOver);
            host.addEventListener('mouseout', this._boundSourceOut);
            this._sourceHoverAttached = true;
        },
        detachSourceHoverListeners() {
            const host = this.$refs.editor;
            if (!host || !this._sourceHoverAttached) return;
            host.removeEventListener('mouseover', this._boundSourceOver);
            host.removeEventListener('mouseout', this._boundSourceOut);
            this._sourceHoverAttached = false;
        },
        // ──── PDF 하이라이트 모달 (백엔드가 미리 렌더링한 preview_url 사용) ────
        openHighlightModal(src) {
            if (!src || !src.preview_url) return;
            this.highlightModal.visible = true;
            this.highlightModal.fileName = src.file_name || src.title || '참고 문서';
            this.highlightModal.pageLabel = src.page != null ? `페이지 ${src.page}` : '';
            this.highlightModal.url = src.preview_url;
        },
        closeHighlightModal() {
            this.highlightModal.visible = false;
            this.highlightModal.url = '';
        }
    },
    mounted() {
        this.$nextTick(() => this.attachSourceHoverListeners());
    },
    updated() {
        // bodyHtml이 바뀌어 editor가 새로 그려져도 컨테이너(ref)는 유지되므로
        // 위임 리스너는 한 번만 붙이면 된다.
        if (!this._sourceHoverAttached) this.attachSourceHoverListeners();
    },
    beforeUnmount() {
        if (this.loadTimer) clearTimeout(this.loadTimer);
        this.loadTimer = null;
        if (this.editNoticeTimer) clearTimeout(this.editNoticeTimer);
        this.editNoticeTimer = null;
        if (Array.isArray(this.editHighlightTimers)) {
            this.editHighlightTimers.forEach((t) => clearTimeout(t));
        }
        this.editHighlightTimers = [];
        if (this.sourceTooltipHideTimer) clearTimeout(this.sourceTooltipHideTimer);
        this.sourceTooltipHideTimer = null;
        this.detachSourceHoverListeners();
        this.removeStyleTag();
    }
};
</script>

<style scoped>
.hwpx-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.hwpx-viewer__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px 8px 12px;
    border-bottom: 1px solid rgba(var(--v-theme-borderColor), 0.7);
}

.hwpx-viewer__title {
    font-size: 14px;
    font-weight: 600;
}

.hwpx-viewer__body {
    flex: 1;
    min-height: 0;
    position: relative;
}

.hwpx-viewer__state {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
}

.hwpx-viewer__state--error {
    color: rgb(var(--v-theme-error));
}

.hwpx-viewer__content {
    height: 100%;
    overflow: auto;
    background: #f8fafc;
}

.hwpx-viewer__html {
    min-height: 100%;
    padding: 0;
}

/* BPMN 다이어그램 — 부모 높이 전부 사용(하단까지). 컨테이너가 height:100% 라 부모에 높이 필요 */
.hwpx-viewer__bpmn {
    height: 100%;
    width: 100%;
    min-height: 0;
    position: relative;
    background: #f8fafc;
}
/* 미리보기에서는 미니맵 숨김(요청) */
.hwpx-viewer__bpmn :deep(.djs-minimap) {
    display: none !important;
}
.hwpx-viewer__code {
    margin: 0;
    height: 100%;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'D2Coding', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.5;
    background: rgba(var(--v-theme-on-surface), 0.04);
    padding: 12px;
}
/* 편집 가능한 코드/원본 textarea */
.hwpx-viewer__code-edit {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 320px;
    box-sizing: border-box;
    margin: 0;
    resize: none;
    border: none;
    border-top: 1px solid rgba(var(--v-theme-borderColor), 0.6);
    padding: 12px;
    font-family: 'D2Coding', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.5;
    color: rgb(var(--v-theme-on-surface));
    background: rgba(var(--v-theme-on-surface), 0.02);
    white-space: pre;
    overflow: auto;
    outline: none;
}
.hwpx-viewer__code-edit:focus {
    background: rgba(var(--v-theme-primary), 0.03);
}

/* 폼/단순 HTML 미리보기 가독성 — 카드형 흰 배경 + 폼 컨트롤 스타일(생성된 폼이 밋밋하게 보이지 않도록) */
:deep(.hwpx-viewer__html .hwpx-doc) {
    padding: 20px 22px;
}
:deep(.hwpx-viewer__html .hwpx-doc form) {
    display: inline-block;
    min-width: min(560px, 100%);
    background: #fff;
    border: 1px solid rgba(15, 23, 42, 0.1);
    border-radius: 10px;
    padding: 22px 24px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
}
:deep(.hwpx-viewer__html .hwpx-doc h1) {
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 16px;
    color: #0f172a;
}
:deep(.hwpx-viewer__html .hwpx-doc label) {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #334155;
    margin: 14px 0 5px;
}
:deep(.hwpx-viewer__html .hwpx-doc input),
:deep(.hwpx-viewer__html .hwpx-doc select),
:deep(.hwpx-viewer__html .hwpx-doc textarea) {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    font-size: 13px;
    border: 1px solid rgba(15, 23, 42, 0.18);
    border-radius: 6px;
    background: #fff;
    color: #0f172a;
    outline: none;
}
:deep(.hwpx-viewer__html .hwpx-doc input[type='checkbox']),
:deep(.hwpx-viewer__html .hwpx-doc input[type='radio']) {
    width: auto;
}
:deep(.hwpx-viewer__html .hwpx-doc input:focus),
:deep(.hwpx-viewer__html .hwpx-doc select:focus),
:deep(.hwpx-viewer__html .hwpx-doc textarea:focus) {
    border-color: rgb(var(--v-theme-primary));
}
:deep(.hwpx-viewer__html .hwpx-doc input[type='submit']),
:deep(.hwpx-viewer__html .hwpx-doc button) {
    width: auto;
    margin-top: 18px;
    padding: 8px 20px;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    background: rgb(var(--v-theme-primary));
    border: none;
    border-radius: 6px;
    cursor: pointer;
}

/* 미리보기/코드 토글 */
.hwpx-viewer__toggle {
    display: inline-flex;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.18);
    border-radius: 7px;
    overflow: hidden;
}
.hwpx-viewer__toggle button {
    font-size: 11px;
    padding: 3px 10px;
    background: transparent;
    color: rgba(var(--v-theme-on-surface), 0.6);
    border: none;
    cursor: pointer;
}
.hwpx-viewer__toggle button.is-on {
    background: rgb(var(--v-theme-primary));
    color: #fff;
}

.hwpx-viewer__html.is-editing {
    outline: 2px solid rgba(0, 133, 219, 0.4);
    background: #ffffff;
    cursor: text;
}

:deep(.hwpx-viewer__html.section-edit-mode) {
    cursor: crosshair;
}

:deep(.hwpx-viewer__html.section-edit-mode [data-id]:hover) {
    outline: 2px dashed rgba(0, 133, 219, 0.6);
    cursor: pointer;
}

/* ──── 출처 참조 시각 마커 + 호버 툴팁 ──── */
/* 참고자료를 근거로 작성된 노드는 좌측에 옅은 녹색 바로 표시 */
:deep(.hwpx-viewer__html [data-sources]) {
    position: relative;
    transition: background 0.15s ease;
}
:deep(.hwpx-viewer__html p[data-sources]),
:deep(.hwpx-viewer__html div[data-sources]) {
    border-left: 3px solid rgba(56, 176, 100, 0.45);
    padding-left: 6px;
    margin-left: -9px;
}
:deep(.hwpx-viewer__html td[data-sources]) {
    /* 표 셀 레이아웃 깨지 않게 box-shadow로 내부 좌측 바 */
    box-shadow: inset 3px 0 0 rgba(56, 176, 100, 0.5);
}
/* 편집 모드 아닐 때만 hover 효과 */
:deep(.hwpx-viewer__html:not(.is-editing):not(.section-edit-mode) [data-sources]:hover) {
    background: rgba(56, 176, 100, 0.08);
    cursor: help;
}

.hwpx-source-tooltip {
    position: fixed;
    z-index: 3000;
    max-width: 360px;
    min-width: 240px;
    background: #ffffff;
    border: 1px solid rgba(56, 176, 100, 0.4);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    padding: 10px 12px;
    font-size: 12px;
    line-height: 1.45;
    color: #1f2937;
    animation: hwpxSourceTipIn 0.12s ease;
    pointer-events: auto;
}

@keyframes hwpxSourceTipIn {
    from { opacity: 0; transform: translateY(-2px); }
    to { opacity: 1; transform: translateY(0); }
}

.hwpx-source-tooltip__header {
    display: flex;
    align-items: center;
    font-weight: 600;
    font-size: 12px;
    color: #1b8048;
    padding-bottom: 6px;
    margin-bottom: 6px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.hwpx-source-tooltip__item {
    padding: 6px 0;
    border-top: 1px dashed rgba(0, 0, 0, 0.05);
}
.hwpx-source-tooltip__item:first-of-type {
    border-top: none;
}

.hwpx-source-tooltip__file {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 3px;
}

.hwpx-source-tooltip__file-name {
    font-weight: 600;
    color: #111827;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.hwpx-source-tooltip__page {
    font-size: 10px;
    color: #1b8048;
    background: rgba(56, 176, 100, 0.12);
    padding: 1px 6px;
    border-radius: 3px;
    font-weight: 600;
    white-space: nowrap;
}

.hwpx-source-tooltip__section {
    display: flex;
    align-items: center;
    font-size: 11px;
    color: #4b5563;
    margin-bottom: 3px;
}

.hwpx-source-tooltip__snippet {
    color: #374151;
    font-size: 11px;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
    white-space: normal;
}

.hwpx-source-tooltip__link {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    margin-top: 4px;
    color: #1b8048;
    font-size: 11px;
    text-decoration: none;
}
.hwpx-source-tooltip__link:hover {
    text-decoration: underline;
}

.hwpx-source-tooltip__thumb-wrap {
    margin: 5px 0 6px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 4px;
    overflow: hidden;
    cursor: zoom-in;
    background: #f8fafc;
    transition: border-color 0.15s ease, transform 0.08s ease;
}
.hwpx-source-tooltip__thumb-wrap:hover {
    border-color: rgba(56, 176, 100, 0.55);
    transform: scale(1.01);
}
.hwpx-source-tooltip__thumb {
    display: block;
    width: 100%;
    max-height: 160px;
    object-fit: contain;
    background: #fff;
}
.hwpx-highlight-modal__img {
    max-width: 100%;
    max-height: 78vh;
    object-fit: contain;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
    border-radius: 4px;
}

.hwpx-selection-rect {
    position: fixed;
    border: 1px dashed rgba(0, 133, 219, 0.9);
    background: rgba(0, 133, 219, 0.12);
    pointer-events: none;
    z-index: 1000;
}

:deep(.hwpx-edit-highlight) {
    background: rgba(255, 215, 64, 0.35);
    transition: background 0.4s ease;
}

/* ──── 이미지 AI 개선 오버레이 버튼 ──── */
.img-enhance-overlay {
    position: fixed;
    z-index: 2000;
    pointer-events: auto;
    animation: fadeInOverlay 0.15s ease;
}

@keyframes fadeInOverlay {
    from {
        opacity: 0;
        transform: translateY(-4px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* ──── 이미지 비교(reveal) 위젯 ──── */
.img-compare {
    position: relative;
    overflow: hidden;
    cursor: col-resize;
    user-select: none;
    border-radius: 6px;
    background: #1a1a2e;
    line-height: 0;
}

.img-compare__after {
    display: block;
    width: 100%;
    max-height: 460px;
    object-fit: contain;
}

.img-compare__before {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.img-compare__divider {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #ffffff;
    transform: translateX(-50%);
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
    pointer-events: none;
}

.img-compare__handle {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
}

.img-compare__lbl {
    position: absolute;
    bottom: 10px;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-size: 11px;
    line-height: 16px;
    padding: 2px 8px;
    border-radius: 4px;
    pointer-events: none;
}

.img-compare__lbl--l {
    left: 10px;
}
.img-compare__lbl--r {
    right: 10px;
}
</style>

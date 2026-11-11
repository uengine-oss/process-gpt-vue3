<template>
    <div class="form-text-area">
        <!-- 내용이 markdown/json 이면 원본 대신 보기 좋게 렌더한다.
             편집 가능한 폼에서는 미리보기 ⇄ 편집 토글을 제공한다(읽기전용은 항상 미리보기).
             읽기전용의 평문도 높이가 정해진 입력 칸 대신 글 그대로 다 보여 준다. -->
        <div v-if="showFormatted || showPlainReadonly" class="form-text-area__readonly">
            <div v-if="!labelHidden || !isReadonlyView" class="form-text-area__labelrow" :class="{ 'is-label-hidden': labelHidden }">
                <span v-if="!labelHidden" class="form-text-area__label">{{ displayLabel }}</span>
                <v-btn v-if="!isReadonlyView" size="x-small" variant="text" prepend-icon="mdi-pencil-outline" @click="previewMode = false"
                    >편집</v-btn
                >
            </div>
            <pre v-if="formattedKind === 'json'" class="form-text-area__json">{{ prettyJson }}</pre>
            <div v-else-if="showPlainReadonly" class="form-text-area__plain">{{ localModelValue }}</div>
            <div v-else-if="hasContent" class="form-text-area__md" v-html="renderedMarkdown"></div>
            <div v-else class="form-text-area__empty">-</div>
        </div>
        <div v-else>
            <div v-if="canFormat && !isReadonlyView" class="form-text-area__togglerow">
                <v-btn size="x-small" variant="text" prepend-icon="mdi-eye-outline" @click="previewMode = true">미리보기</v-btn>
            </div>
            <v-textarea
                v-model="localModelValue"
                :disabled="localDisabled"
                :readonly="localReadonly"
                :rows="rows"
                :variant="localReadonly ? 'filled' : 'outlined'"
                :hide-details="hideDetails"
                :density="density"
                :placeholder="placeholder || undefined"
                :persistent-placeholder="!!placeholder"
            >
                <template v-if="!labelHidden" v-slot:label>
                    <span style="color: var(--cds-text-primary)">
                        {{ displayLabel }}
                    </span>
                </template>
            </v-textarea>
        </div>
    </div>
</template>

<script>
import { commonSettingInfos } from './CommonSettingInfos.vue';
import { looksLikeMarkdown, renderMarkdown } from '@/shared/markdownText/index.js';

export default {
    name: 'TextareaField',

    props: {
        // UI 관련 설정 props 시작
        hideDetails: {
            type: Boolean,
            default: false
        },
        density: {
            type: String,
            default: 'compact'
        },
        // UI 관련 설정 props 끝
        modelValue: String,
        vueRenderUUID: String,
        tagName: String,

        name: String,
        alias: String,
        rows: String,
        disabled: String,
        readonly: String,
        // 업무 화면이 붙이는 표시 속성(저장된 폼에는 없다) — 카드 제목과 같은 칸 이름을 한 번만 보이게(formPresentation)
        hide_label: String,
        placeholder: String
    },

    data() {
        return {
            localModelValue: '',
            // 편집 폼에서 markdown/json: 이미 채워진 채로 열리면 미리보기, 빈 칸에 직접 타이핑하면 편집 유지.
            // (mounted 에서 초기 내용 유무로 결정 — 타이핑 중 자동 전환 방지)
            previewMode: false,

            localName: '',
            localAlias: '',
            localRows: '',
            localDisabled: false,
            localReadonly: false,

            settingInfos: [
                commonSettingInfos['localName'],
                commonSettingInfos['localAlias'],
                {
                    dataToUse: 'localRows',
                    htmlAttribute: 'rows',
                    settingLabel: 'Rows',
                    settingType: 'number',
                    validCheck: (value) => {
                        if (!value || Number(value) <= 0) return 'Rows 속성에 0 이상의 값을 입력해 주세요.';
                        return null;
                    }
                },
                commonSettingInfos['localDisabled'],
                commonSettingInfos['localReadonly']
            ]
        };
    },

    computed: {
        displayLabel() {
            return this.localAlias && this.localAlias.length > 0 ? this.localAlias : this.localName;
        },
        isReadonlyView() {
            return this.localReadonly || this.localDisabled;
        },
        labelHidden() {
            return this.hide_label === 'true';
        },
        showPlainReadonly() {
            // 읽기전용의 평문: 입력 칸(5줄 높이 · 안쪽 스크롤) 대신 글을 그대로 보인다
            return this.isReadonlyView && this.formattedKind === 'text' && this.hasContent;
        },
        canFormat() {
            // 내용이 markdown/json 이라 포맷 렌더가 의미있는 경우.
            return this.formattedKind !== 'text';
        },
        showFormatted() {
            // 읽기전용은 항상 포맷 렌더, 편집 폼은 previewMode 일 때 렌더(토글로 편집 전환).
            return this.canFormat && (this.isReadonlyView || this.previewMode);
        },
        hasContent() {
            return !!(this.localModelValue || '').toString().trim();
        },
        formattedKind() {
            // 내용이 json/markdown/평문 중 무엇인지 판단(평문은 렌더 대상 아님).
            const raw = (this.localModelValue || '').toString().trim();
            if (!raw) return 'text';
            if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
                try {
                    JSON.parse(raw);
                    return 'json';
                } catch (e) {
                    // JSON 아님 → 마크다운 판정으로 진행
                }
            }
            // 마크다운 마커가 있거나 줄 머리("적합한 점:")로 나뉜 글일 때만 마크다운으로 취급(평문 오탐 방지).
            return looksLikeMarkdown(raw) ? 'markdown' : 'text';
        },
        prettyJson() {
            const raw = (this.localModelValue || '').toString().trim();
            try {
                return JSON.stringify(JSON.parse(raw), null, 2);
            } catch (e) {
                return raw;
            }
        },
        renderedMarkdown() {
            // 줄 머리 · 목록 경계를 바로잡고, 사람 · 에이전트가 쓴 글이라 HTML 은 걸러서 넣는다(markdownText)
            const text = (this.localModelValue || '').toString();
            try {
                return renderMarkdown(text);
            } catch (e) {
                // 그리지 못하면 글자 그대로(태그로 해석되지 않게 바꿔서)
                return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
            }
        }
    },

    watch: {
        modelValue: {
            handler(newVal) {
                const incoming = newVal && newVal.length > 0 ? newVal : '';
                // 외부(에이전트 생성 결과 등)에서 값이 들어온 경우에만 처리한다.
                // 사용자가 textarea 로 타이핑한 값은 emit 되어 되돌아오므로 localModelValue 와 같아 무시된다.
                if (incoming !== this.localModelValue) {
                    this.localModelValue = incoming;
                    // 생성이 완료되어 내용이 채워지면 항상 미리보기부터 보여준다(편집 클릭 시 원문).
                    if (incoming.trim()) {
                        this.previewMode = true;
                    }
                }
            },
            deep: true,
            immediate: true
        },

        localModelValue: {
            handler() {
                this.$emit('update:modelValue', this.localModelValue);
            },
            deep: true,
            immediate: true
        }
    },

    async mounted() {
        // (초기/생성 값에 따른 미리보기 전환은 modelValue watch 가 담당)
        // EventBus 이벤트 리스너 등록
        if (this.EventBus) {
            this.EventBus.on('parsed-content-generated', this.handleParsedContent);
            console.log('[TextareaField] EventBus 리스너 등록 완료');
        }
    },

    beforeUnmount() {
        // EventBus 이벤트 리스너 해제
        if (this.EventBus) {
            this.EventBus.off('parsed-content-generated', this.handleParsedContent);
            console.log('[TextareaField] EventBus 리스너 해제 완료');
        }
    },

    methods: {
        handleParsedContent(data) {
            console.log('[TextareaField] EventBus로부터 파싱된 텍스트 수신:', data);

            if (!data || !data.contents || data.contents.length === 0) {
                console.warn('[TextareaField] 수신된 텍스트가 없습니다.');
                return;
            }

            // 여러 파일의 파싱된 내용을 "파일1: 파일1내용, 파일2: 파일2내용, ..." 형식으로 합치기
            const combinedContent = data.contents
                .map((item, index) => {
                    const fileName = item.fileName || `파일${index + 1}`;
                    const content = (item.content || '').trim();
                    return `${fileName}: ${content}`;
                })
                .join(', ');

            // 기존 값이 비어있는 경우에만 세팅
            if (!this.localModelValue || this.localModelValue.trim() === '') {
                this.localModelValue = combinedContent;
                console.log(
                    `[TextareaField] 파싱된 텍스트가 세팅되었습니다. (${combinedContent.length}자, ${data.contents.length}개 파일)`
                );
            } else {
                console.log('[TextareaField] 이미 값이 존재하여 파싱된 텍스트를 세팅하지 않았습니다.');
            }
        }
    },

    created() {
        // localModelValue 초기화는 modelValue watch(immediate)가 담당한다.
        this.localName = this.name ?? 'name';
        this.localAlias = this.alias ?? '';
        this.localRows = this.rows ?? 5;
        this.localDisabled = this.disabled === 'true';
        this.localReadonly = this.readonly === 'true';
    }
};
</script>

<style lang="scss">
.form-text-area {
    margin-bottom: 16px;
}
.form-text-area__readonly {
    border: 1px solid var(--cds-border);
    border-radius: 8px;
    background: var(--cds-bg-neutral);
    padding: 10px 12px;
}
.form-text-area__label {
    font-size: 12px;
    color: var(--cds-text-secondary);
    margin-bottom: 6px;
}
.form-text-area__labelrow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
}
.form-text-area__labelrow .form-text-area__label {
    margin-bottom: 0;
}
.form-text-area__togglerow {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 2px;
}
.form-text-area__json {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'Consolas', 'Menlo', monospace;
    font-size: 12.5px;
    color: var(--cds-text-primary);
}
.form-text-area__empty {
    font-size: 13.5px;
    color: var(--cds-text-muted);
}
.form-text-area__labelrow.is-label-hidden {
    justify-content: flex-end;
}
.form-text-area__plain {
    font-size: 13.5px;
    color: var(--cds-text-primary);
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
}
/* 이 스타일 블록은 scoped 가 아니다 — :deep() 을 쓰면 선택자가 그대로 남아 아무 데도 맞지 않는다
   (예전에는 그래서 목록 들여쓰기가 0 이 되어 글머리가 글 칸 밖으로 튀어나왔다). 자손 선택자로 쓴다. */
.form-text-area__md {
    font-size: 13.5px;
    color: var(--cds-text-primary);
    line-height: 1.6;
    white-space: normal;
    word-break: break-word;
}
.form-text-area__md > :first-child {
    margin-top: 0;
}
.form-text-area__md > :last-child {
    margin-bottom: 0;
}
.form-text-area__md p {
    margin: 0 0 8px;
}
.form-text-area__md p.md-section {
    margin: 14px 0 4px;
    font-weight: 700;
}
.form-text-area__md p.md-section:first-child {
    margin-top: 0;
}
.form-text-area__md h1,
.form-text-area__md h2,
.form-text-area__md h3,
.form-text-area__md h4,
.form-text-area__md h5,
.form-text-area__md h6 {
    margin: 14px 0 6px;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.4;
}
.form-text-area__md ul,
.form-text-area__md ol {
    margin: 0 0 8px;
    padding-left: 1.5em;
}
.form-text-area__md ul {
    list-style: disc outside;
}
.form-text-area__md ol {
    list-style: decimal outside;
}
.form-text-area__md ul ul {
    list-style-type: circle;
    margin-bottom: 0;
}
.form-text-area__md ol ol,
.form-text-area__md ul ol,
.form-text-area__md ol ul {
    margin-bottom: 0;
}
.form-text-area__md li {
    margin: 2px 0;
    padding-left: 2px;
}
.form-text-area__md li > p {
    margin: 0;
}
.form-text-area__md blockquote {
    margin: 0 0 8px;
    padding-left: 10px;
    border-left: 3px solid var(--cds-border);
    color: var(--cds-text-secondary);
}
.form-text-area__md table {
    border-collapse: collapse;
    margin: 6px 0;
}
.form-text-area__md th,
.form-text-area__md td {
    border: 1px solid var(--cds-border);
    padding: 4px 8px;
}
.form-text-area__md code {
    background: var(--cds-surface-2, #eceef1);
    padding: 1px 4px;
    border-radius: 4px;
}
.form-text-area__md pre {
    background: var(--cds-surface-2, #eceef1);
    padding: 8px;
    border-radius: 6px;
    overflow-x: auto;
}
.form-text-area__md pre code {
    padding: 0;
    background: transparent;
}
.form-text-area__md img {
    max-width: 100%;
}
</style>

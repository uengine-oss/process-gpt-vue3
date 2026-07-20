<template>
    <div class="form-text-area">
        <!-- 내용이 markdown/json 이면 원본 대신 보기 좋게 렌더한다.
             편집 가능한 폼에서는 미리보기 ⇄ 편집 토글을 제공한다(읽기전용은 항상 미리보기). -->
        <div v-if="showFormatted" class="form-text-area__readonly">
            <div class="form-text-area__labelrow">
                <span class="form-text-area__label">{{ displayLabel }}</span>
                <v-btn v-if="!isReadonlyView" size="x-small" variant="text" prepend-icon="mdi-pencil-outline" @click="previewMode = false"
                    >편집</v-btn
                >
            </div>
            <pre v-if="formattedKind === 'json'" class="form-text-area__json">{{ prettyJson }}</pre>
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
            >
                <template v-slot:label>
                    <span style="color: black">
                        {{ displayLabel }}
                    </span>
                </template>
            </v-textarea>
        </div>
    </div>
</template>

<script>
import { commonSettingInfos } from './CommonSettingInfos.vue';
import { marked } from 'marked';

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
        readonly: String
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
            // 마크다운 마커가 있을 때만 마크다운으로 취급(평문 오탐 방지).
            const mdSignals = [
                /(^|\n)#{1,6}\s/, // 헤딩
                /(^|\n)\s*[-*+]\s+\S/, // 불릿
                /(^|\n)\s*\d+\.\s+\S/, // 번호목록
                /```/, // 코드펜스
                /(^|\n)\s*>\s+\S/, // 인용
                /\|.+\|/, // 표
                /\[[^\]]+\]\([^)]+\)/, // 링크
                /\*\*[^*]+\*\*/ // 강조
            ];
            if (mdSignals.some((re) => re.test(raw))) return 'markdown';
            return 'text';
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
            try {
                return marked.parse((this.localModelValue || '').toString());
            } catch (e) {
                return (this.localModelValue || '').toString();
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
    border: 1px solid #e4e6ea;
    border-radius: 8px;
    background: #f7f8fa;
    padding: 10px 12px;
}
.form-text-area__label {
    font-size: 12px;
    color: #6b7280;
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
    color: #1f2937;
}
.form-text-area__empty {
    font-size: 13.5px;
    color: #9ca3af;
}
.form-text-area__md {
    font-size: 13.5px;
    color: #1f2937;
    line-height: 1.6;
    white-space: normal;
    word-break: break-word;
}
.form-text-area__md :deep(p) {
    margin: 0 0 6px;
}
.form-text-area__md :deep(h1),
.form-text-area__md :deep(h2),
.form-text-area__md :deep(h3) {
    margin: 8px 0 4px;
    font-weight: 700;
}
.form-text-area__md :deep(ul),
.form-text-area__md :deep(ol) {
    padding-left: 20px;
    margin: 4px 0;
}
.form-text-area__md :deep(table) {
    border-collapse: collapse;
    margin: 6px 0;
}
.form-text-area__md :deep(th),
.form-text-area__md :deep(td) {
    border: 1px solid #d1d5db;
    padding: 4px 8px;
}
.form-text-area__md :deep(code) {
    background: #eceef1;
    padding: 1px 4px;
    border-radius: 4px;
}
.form-text-area__md :deep(pre) {
    background: #eceef1;
    padding: 8px;
    border-radius: 6px;
    overflow-x: auto;
}
</style>

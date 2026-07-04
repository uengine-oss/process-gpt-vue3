<template>
    <div class="form-text-area">
        <!-- 읽기 전용 + 내용이 markdown/json 이면 원본 대신 보기 좋게 렌더한다. -->
        <div v-if="isReadonlyView && formattedKind !== 'text'" class="form-text-area__readonly">
            <div class="form-text-area__label">{{ displayLabel }}</div>
            <pre v-if="formattedKind === 'json'" class="form-text-area__json">{{ prettyJson }}</pre>
            <div v-else class="form-text-area__md" v-html="renderedMarkdown"></div>
        </div>
        <v-textarea
            v-else
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
        formattedKind() {
            // 읽기 전용일 때만 md/json 을 렌더 대상으로 판단(편집 중엔 원본 유지).
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
            handler() {
                this.localModelValue = this.modelValue && this.modelValue.length > 0 ? this.modelValue : '';
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
        this.localModelValue = this.modelValue ?? '';

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
.form-text-area__json {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'Consolas', 'Menlo', monospace;
    font-size: 12.5px;
    color: #1f2937;
}
.form-text-area__md {
    font-size: 13.5px;
    color: #1f2937;
    line-height: 1.6;
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

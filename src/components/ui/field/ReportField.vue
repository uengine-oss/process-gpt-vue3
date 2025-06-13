<template>
    <div>
        <!-- <slide-component :key="localModelValue" style="width: 100%; height: 250px;" :content="localModelValue" :isEditMode="false" class="presentation-slide" /> -->
        <v-card class="rounded-lg mb-2" :style="`background-color: ${hexToRgba(themeColor, 0.05)} !important;`" elevation="0" hover>
            <!-- y축 기준 중앙정렬을 위해 align-center 클래스 추가 -->
            <v-row class="ma-0 pa-4 align-center" @click="editMarkdown">
                <div v-if="localModelValue.length > 0" >
                    <MarkdownEditor :style="`height: 38px; width: 38px; margin-right: 8px;`" v-model="localModelValue" :readOnly="true" :isPreview="true" />
                </div>
                <div v-else :style="`background-color: ${hexToRgba(themeColor, 0.8)} !important; !important; border-radius: 8px; padding: 8px; margin-right: 8px;`">
                    <Icons :icon="'report'" color="white" />
                </div>
                <div>
                    <div class="font-weight-medium">{{ localAlias ? localAlias : localName }}</div>
                </div>
                <v-spacer></v-spacer>
                <!-- 드롭다운 미리보기 버튼 제거, 대신 토글 버튼으로 변경 -->
                <div
                    @click.stop="previewMenu = !previewMenu"
                    style="border-radius: 8px; border: 1px solid #e0e0e0; width: 30px; height: 30px; margin-right: 8px; cursor: pointer;"
                    class="d-flex align-center justify-center"
                >
                    <v-icon :icon="previewMenu ? 'mdi-chevron-up' : 'mdi-chevron-down'" :style="`color: ${hexToRgba(themeColor, 0.8)}`" size="20"></v-icon>
                </div>
                <!-- 기존 눈 아이콘 -->
                <div
                    style="border-radius: 8px; border: 1px solid #e0e0e0; width: 30px; height: 30px;"
                    class="d-flex align-center justify-center"
                >
                    <v-icon icon="mdi-eye-outline" :style="`color: ${hexToRgba(themeColor, 0.8)}`" size="20"></v-icon>
                </div>
            </v-row>
            <!-- 미리보기 확장 영역 -->
            <v-row v-if="previewMenu" class="ma-0 pa-0">
                <v-sheet elevation="3" rounded style="width: 100%; min-width: 400px; min-height: 300px; padding: 16px; background: white;">
                    <MarkdownEditor
                        :style="'width: 100%; height: 100%;'"
                        v-model="localModelValue"
                        :readOnly="true"
                        :isPreview="true"
                        :isOverflow="true"
                    />
                </v-sheet>
            </v-row>
        </v-card>
        <v-dialog 
            v-model="showDialog" 
            persistent 
            max-width="1600px" 
            transition="dialog-transition"
        >
            <v-card>
                <v-card-title>컨텐츠 에디터</v-card-title>
                <v-card-text class="ml-4 mr-4 editor" style="height: 80vh; padding: 0 !important; overflow: auto;">
                    <markdown-editor
                        ref="markdownEditor"
                        v-model="localModelValue"
                        @save="saveMarkdownContent"
                        :useDefaultEditorStyle="false"
                        :readOnly="localReadonly"
                    ></markdown-editor>
                </v-card-text>
                <v-row class="ma-0 pa-4">
                    <v-spacer></v-spacer>
                    <v-btn @click="cancelMarkdown"
                        variant="elevated" 
                        class="rounded-pill mr-2"
                        density="compact"
                        >취소
                    </v-btn>
                    <v-btn @click="saveMarkdown"
                        :color="themeColor"
                        variant="elevated" 
                        class="rounded-pill"
                        density="compact"
                    >저장</v-btn>
                </v-row>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import { commonSettingInfos } from "./CommonSettingInfos.vue"
import SlideComponent from '@/views/markdown/SlideComponent.vue';
import SlideEditor from '@/views/markdown/SlideEditor.vue';
import MarkdownEditor from '@/views/markdown/MarkdownEditor.vue';
import Icons from "@/components/ui-components/Icons.vue";
import ThemeColorMixin from "./ThemeColorMixin.js";
import SlidePresentation from '@/views/markdown/SlidePresentation.vue';

export default {
    name: "ContentEditorField",
    components: {
        SlideComponent,
        SlideEditor,
        MarkdownEditor,
        Icons,
        SlidePresentation
    },
    mixins: [ThemeColorMixin],
    computed: {
        defaultContent() {
            if(this.$t) {
                return this.$t("ContentEditorField.defaultContent")
            }
            return `# 당신의 프레젠테이션에 오신 것을 환영합니다 

---

## 수평 슬라이드

한 줄에 하이픈 세 개를 입력하면 새로운 수평 슬라이드가 생성됩니다

---

## 수직 슬라이드

한 줄에 하이픈 두 개를 입력하면 수직 슬라이드를 만들 수 있습니다

--

### 이것은 수직 슬라이드입니다

위/아래 방향키로 이동하세요

---

## 순차 등장 (Fragments)

항목들이 하나씩 등장합니다

* 첫 번째 포인트 <!-- .element: class=\"fragment\" -->
* 두 번째 포인트 <!-- .element: class=\"fragment\" -->
* 세 번째 포인트 <!-- .element: class=\"fragment\" -->

---

## 코드 하이라이팅

\`\`\` [2-3|4|5]
[1-2|3|4]
let a = 1;
let b = 2;
let c = x => 1 + 2 + x;
c(3);
\`\`\`

---

## 발표자 노트

이 슬라이드에는 발표자 노트가 있습니다.

Note: 이 노트는 발표자 모드에서만 보입니다.
"S" 키를 눌러 발표자 모드를 여세요.

---

## 수학 수식

$e^{i\\pi} + 1 = 0$

---

## PDF로 내보내기

이 프레젠테이션을 PDF 파일로 내보낼 수 있습니다!`        

        }
    },
    
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
        mode: String,
        disabled: String,
        readonly: String
    },

    data() {
        return {
            localModelValue: "",
            localName: "",
            localAlias: "",
            localDisabled: false,
            localReadonly: false,
            showDialog: false,
            editorValue: "",
            previewMenu: false,

            settingInfos: [
                commonSettingInfos["localName"],
                commonSettingInfos["localAlias"],
                commonSettingInfos["localDisabled"],
                commonSettingInfos["localReadonly"]
            ]
        };
    },

    watch: {
        modelValue: {
            handler() {
                this.localModelValue  = ((this.modelValue && this.modelValue.length > 0) ? this.modelValue : "")
            },
            deep: true,
            immediate: true
        },

        localModelValue: {
            handler() {
                this.$emit('update:modelValue', this.localModelValue)
            },
            deep: true,
            immediate: true
        },
    },

    created() {
        this.localModelValue = this.modelValue ?? ""
        
        this.localName = this.name ?? "name"
        this.localAlias = this.alias ?? ""
        this.localDisabled = this.disabled === "true"
        this.localReadonly = this.readonly === "true"
    },

    mounted() {
        this.localModelValue = this.modelValue ?? this.defaultContent;
    },
    methods: {
        saveMarkdown() {
            const markdownEditor = this.$refs.markdownEditor;
            markdownEditor.save();
        },
        saveMarkdownContent(markdownContent) {
            this.localModelValue = markdownContent;
            this.editorValue = this.localModelValue;
            this.showDialog = false;
        },
        editMarkdown() {
            this.editorValue = this.localModelValue;
            this.showDialog = true;
        },
        cancelMarkdown() {
            this.showDialog = false;
        },
        onDialogReady() {
            console.log("onDialogReady")
            this.$refs.slideEditor.init();
        }
    }
}
</script>

<style lang="scss">
.form-text-area {
    margin-bottom: 16px;
}

.editor {
  flex: 1;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: monospace;
  resize: none;
  line-height: 1.5;
  font-size: 14px;
}
</style>

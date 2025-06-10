<template>
    <div>
        <!-- <slide-component :key="localModelValue" style="width: 100%; height: 250px;" :content="localModelValue" :isEditMode="false" class="presentation-slide" /> -->
        <v-card class="rounded-lg mb-2" :style="`background-color: ${hexToRgba(themeColor, 0.05)} !important;`" elevation="0" @click="editMarkdown" hover>
            <!-- y축 기준 중앙정렬을 위해 align-center 클래스 추가 -->
            <v-row class="ma-0 pa-4 align-center">
                <div :style="`background-color: ${hexToRgba(themeColor, 0.8)} !important; !important; border-radius: 8px; padding: 8px; margin-right: 8px;`">
                    <Icons :icon="'slide-show'" color="white" />
                </div>
                <div>
                    <div class="font-weight-medium">{{ localAlias ? localAlias : localName }}</div>
                </div>
                <v-spacer></v-spacer>
                <!-- Vuetify의 flex 유틸리티를 사용하여 아이콘을 정중앙 정렬 -->
                <div
                    style="border-radius: 8px; border: 1px solid #e0e0e0; width: 30px; height: 30px;"
                    class="d-flex align-center justify-center"
                >
                    <v-icon icon="mdi-eye-outline" :style="`color: ${hexToRgba(themeColor, 0.8)}`" size="20"></v-icon>
                </div>
            </v-row>
        </v-card>
        <v-dialog 
            v-if="!localReadonly"
            v-model="showDialog" 
            persistent 
            max-width="1600px" 
            transition="dialog-transition"
        >
            <v-card>
                <v-card-text style="height: 80vh; padding: 0;">
                <slide-editor
                    :content="localModelValue"
                    style="width: 100%; height: 100%; border: none;"
                    ref="markdownEditor"
                    @save="saveMarkdownContent"
                ></slide-editor>
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
        <v-dialog
            v-if="localReadonly"
            v-model="showDialog" 
            persistent 
            max-width="1600px" 
            transition="dialog-transition"
        >
            <v-card>
                <v-card-text>
                    
                <slide-presentation ref="slidePresentation"
                    :modelValue="localModelValue" 
                    :key="localModelValue" 
                    :isPresentationMode="true"
                    @close="showDialog = false"/>
                </v-card-text>
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
    name: "SlideEditorField",
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
            return '# 당신의 프레젠테이션에 오신 것을 환영합니다 \n\n---\n\n## 수평 슬라이드\n\n한 줄에 하이픈 세 개를 입력하면 새로운 수평 슬라이드가 생성됩니다\n\n---\n\n## 수직 슬라이드\n\n한 줄에 하이픈 두 개를 입력하면 수직 슬라이드를 만들 수 있습니다\n\n--\n\n### 이것은 수직 슬라이드입니다\n\n위/아래 방향키로 이동하세요\n\n---\n\n## 순차 등장 (Fragments)\n\n항목들이 하나씩 등장합니다\n\n* 첫 번째 포인트 <!-- .element: class=\\\"fragment\\\" -->\n* 두 번째 포인트 <!-- .element: class=\\\"fragment\\\" -->\n* 세 번째 포인트 <!-- .element: class=\\\"fragment\\\" -->\n\n---\n\n## 코드 하이라이팅\n\n\\`\\`\\`js [1-2|3|4]\nlet a = 1;\nlet b = 2;\nlet c = x => 1 + 2 + x;\nc(3);\n\\`\\`\\`\n\n---\n\n## 발표자 노트\n\n이 슬라이드에는 발표자 노트가 있습니다.\n\nNote: 이 노트는 발표자 모드에서만 보입니다.\n"S" 키를 눌러 발표자 모드를 여세요.\n\n---\n\n## 수학 수식\n\n$e^{i\\\\pi} + 1 = 0$\n\n---\n\n## PDF로 내보내기\n\n이 프레젠테이션을 PDF 파일로 내보낼 수 있습니다!'
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

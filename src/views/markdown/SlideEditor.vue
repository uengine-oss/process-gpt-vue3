<template>
  <div class="slide-editor">
    <div class="editor-header">
      <v-card-title>Slide Presentation Editor</v-card-title>
      <!-- 모든 버튼을 Vuetify3 라운드 스타일(compact, rounded-pill) 및 컴펫(variant="elevated") 버튼으로 변경 -->
      <div class="actions">
          <v-btn 
              @click="addSlide" 
              :color="themeColor" 
              variant="elevated" 
              class="rounded-pill"
              density="compact"
          >슬라이드 추가</v-btn>
          <v-btn 
              @click="exportMarkdown" 
              :color="themeColor" 
              variant="elevated" 
              class="rounded-pill"
              density="compact"
          >MD 내보내기</v-btn>
          <v-btn 
              @click="openPdfExport" 
              :color="themeColor" 
              variant="elevated" 
              class="rounded-pill"
              density="compact"
          >PDF 내보내기</v-btn>
          <v-btn 
              @click="openPptxExport" 
              :color="themeColor" 
              variant="elevated" 
              class="rounded-pill"
              density="compact"
          >파워포인트 내보내기</v-btn>
          <v-btn 
              @click="openWordExport" 
              :color="themeColor" 
              variant="elevated" 
              class="rounded-pill"
              density="compact"
          >워드 내보내기</v-btn>
          <v-btn 
              :color="themeColor" 
              variant="elevated" 
              class="rounded-pill"
              density="compact"
              @click="$refs.importFile.click()"
          >가져오기</v-btn>
          <input 
              type="file" 
              ref="importFile"
              accept=".md,.txt" 
              @change="importMarkdown" 
              style="display: none;" 
          />
          <v-btn 
              @click="presentation" 
              :color="themeColor" 
              variant="elevated" 
              class="rounded-pill"
              density="compact"
          >프레젠테이션</v-btn>
      </div>
    </div>
    
    <div class="editor-container">
      <!--<div class="slides-sidebar">
        <div class="instruction-box">
          <h3>Markdown Slides</h3>
          <p>Separate slides with <code>---</code> (three dashes on a single line)</p>
          <p>Vertical slides: <code>--</code> (two dashes)</p>
          <p>Speaker notes: Start with <code>Note:</code></p>
          <p>Fragments: <code></code></p>
          <p>Code highlighting: <code>```js [1-2|3|4]</code></p>
          <p><a href="https://revealjs.com/markdown/" target="_blank">More info</a></p>
        </div>
        <slide-styler />
      </div>-->
      
      <div class="editor-content" style="height: 100%; overflow: auto;">
        <markdown-editor
          v-model="markdownContent"
          :useDefaultEditorStyle="false"
        />
      </div>
      
      <div class="preview-panel">
        <!-- 미리보기 안내 텍스트: 회색, 9px 폰트로 표시 -->
        <div class="d-flex align-center ml-1 mt-1">
            <v-icon style="font-size: 18px; color: #888;">mdi-alert-circle</v-icon>
            <div class="ml-1" style="font-size: 14px; color: #888;">미리보기 입니다.</div>
        </div>
        <slide-component 
          v-if="!isPresentationMode"
          :key="markdownContent"
          ref="slideComponent"
          :content="markdownContent"
          :isEditMode="false"
          class="editor-preview"
        />
      </div>
    </div>
    
    <pdf-export-helper ref="pdfExportHelper" />
    <pptx-export-helper ref="pptxExportHelper" />
    <word-export-helper ref="wordExportHelper" />
    <slide-presentation ref="slidePresentation"
     :modelValue="markdownContent" 
     :key="markdownContent" 
     :isPresentationMode="isPresentationMode"
     @close="isPresentationMode = false"/>
  </div>
</template>

<script>
import SlideComponent from './SlideComponent.vue'
import SlideStyler from './SlideStyler.vue'
import SlidePresentation from './SlidePresentation.vue'
import PdfExportHelper from './PdfExportHelper.vue'
import PptxExportHelper from './PptxExportHelper.vue'
import WordExportHelper from './WordExportHelper.vue'
import MarkdownEditor from './MarkdownEditor.vue'
import ThemeColorMixin from '@/components/ui/field/ThemeColorMixin.js'

export default {
  name: 'SlideEditor',
  components: {
    SlideComponent,
    SlideStyler,
    PdfExportHelper,
    PptxExportHelper,
    WordExportHelper,
    MarkdownEditor,
    SlidePresentation
  },
  mixins: [ThemeColorMixin],
  props: {
    content: {
      type: String,
      default: null
    }
  },
  data() {
    return {
      markdownContent: '',
      isPresentationMode: false
    }
  },
  mounted() {
    if(this.content) {
      this.markdownContent = this.content;
      this.init();
    }
  },
  methods: {
    init() {
      this.$nextTick(() => {
        this.$refs.slideComponent.init()
      })
    },
    addSlide() {
      this.markdownContent += `\n\n---\n\n# New Slide\n\nAdd your content here...`
    },
    exportMarkdown() {
      const blob = new Blob([this.markdownContent], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'presentation.md'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },
    importMarkdown(event) {
      const file = event.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          this.markdownContent = e.target.result
        }
        reader.readAsText(file)
      }
    },
    openPdfExport() {
      this.$refs.pdfExportHelper?.openModal()
    },
    openPptxExport() {
      this.$refs.pptxExportHelper?.openModal()
    },
    openWordExport() {
      this.$refs.wordExportHelper?.openModal()
    },
    save() {
      this.$emit('save', this.markdownContent);
    },
    presentation() {
      this.isPresentationMode = true;
    }
  }
}
</script>

<style>
.slide-editor {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #ddd;
}

.editor-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 사이드바는 고정 */
.slides-sidebar {
  flex: 0 0 250px;
  background-color: #f8f8f8;
  border-right: 1px solid #ddd;
  overflow-y: auto;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
}

.instruction-box {
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.instruction-box h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  color: #42b883;
}

.instruction-box p {
  margin: 0;
  font-size: 0.9rem;
}

.instruction-box code {
  background-color: #f0f0f0;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  font-family: monospace;
}

/* 에디터는 유동 (남은 공간에서 preview 뺀 나머지 차지) */
.editor-content {
  flex: 1;
  padding: 1rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}


.markdown-editor {
  flex: 1;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: monospace;
  resize: none;
  line-height: 1.5;
  font-size: 14px;
}

.preview-panel {
  flex: 0 0 40%;
  background: white;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.preview-header {
  padding: 0.5rem 1rem;
  font-weight: bold;
}

.editor-preview {
  padding: 1rem;
  flex: 1;
}

.actions {
  display: flex;
  gap: 8px;
}

.v-btn {
  margin: 0 !important;
}
</style>

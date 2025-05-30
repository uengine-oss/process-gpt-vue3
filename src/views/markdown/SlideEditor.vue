<template>
  <div class="slide-editor">
    <div class="editor-header">
      <h1>Slide Presentation Editor</h1>
      <div class="actions">
        <button @click="addSlide" class="btn">Add Slide</button>
        <button @click="exportMarkdown" class="btn">Export MD</button>
        <button @click="openPdfExport" class="btn">PDF Export</button>
        <button @click="openPptxExport" class="btn">PowerPoint Export</button>
        <label for="import-file" class="btn">Import</label>
        <input 
          type="file" 
          id="import-file" 
          accept=".md,.txt" 
          @change="importMarkdown" 
          style="display: none;" 
        />
        <router-link to="/present" class="btn">Present</router-link>
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
        <div class="preview-header">Preview</div>
        <slide-component 
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
  </div>
</template>

<script>
import SlideComponent from './SlideComponent.vue'
import SlideStyler from './SlideStyler.vue'
import PdfExportHelper from './PdfExportHelper.vue'
import PptxExportHelper from './PptxExportHelper.vue'
import MarkdownEditor from './MarkdownEditor.vue'

export default {
  name: 'SlideEditor',
  components: {
    SlideComponent,
    SlideStyler,
    PdfExportHelper,
    PptxExportHelper,
    MarkdownEditor
  },
  props: {
    content: {
      type: String,
      default: null
    }
  },
  data() {
    return {
      markdownContent: '',
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
    save() {
      this.$emit('save', this.markdownContent);
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
  background-color: #f1f1f1;
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
  border-left: 1px solid #ddd;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.preview-header {
  padding: 0.5rem 1rem;
  background-color: #f1f1f1;
  border-bottom: 1px solid #ddd;
  font-weight: bold;
}

.editor-preview {
  padding: 1rem;
  flex: 1;
}

.btn {
  background-color: #42b883;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  text-decoration: none;
  cursor: pointer;
  font-weight: bold;
  margin-left: 0.5rem;
}

.actions {
  display: flex;
}
</style>

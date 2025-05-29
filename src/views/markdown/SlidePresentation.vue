<template>
  <div class="slide-presentation" @keydown="handleKeydown" tabindex="0" :class="{ 'print-mode': printPdf }">
    <div class="presentation-controls" v-if="!printPdf">
      <button @click="$router.go(-1)" class="control-btn">Exit</button>
      <div>
        <button @click="openPdfExport" class="control-btn">PDF Export</button>
        <button @click="openPptxExport" class="control-btn">PowerPoint Export</button>
      </div>
    </div>
    
    <div class="slide-container">
      <slide-component 
        :content="markdownContent"
        :isEditMode="false"
        class="presentation-slide"
      />
      <div class="slide empty-slide" v-if="!markdownContent">
        <h1>No content available</h1>
        <p>Return to the editor to create your presentation first.</p>
        <router-link to="/" class="btn">Go to Editor</router-link>
      </div>
    </div>
    
    <!-- Add PDF Export Helper Component -->
    <pdf-export-helper ref="pdfExportHelper" />
    <!-- Add PowerPoint Export Helper Component -->
    <pptx-export-helper ref="pptxExportHelper" />
  </div>
</template>

<script>
import SlideComponent from './SlideComponent.vue'
import PdfExportHelper from './PdfExportHelper.vue'
import PptxExportHelper from './PptxExportHelper.vue'

export default {
  name: 'SlidePresentation',
  components: {
    SlideComponent,
    PdfExportHelper,
    PptxExportHelper
  },
  props: {
    printPdf: {
      type: Boolean,
      default: false
    },
    showNotes: {
      type: String,
      default: null
    },
    pdfSeparateFragments: {
      type: String,
      default: null
    },
    previousPage: {
      type: String,
      default: '/'
    }
  },
  data() {
    return {
      markdownContent: ''
    }
  },
  mounted() {
    const savedContent = localStorage.getItem('markdownContent')
    if (savedContent) {
      this.markdownContent = savedContent
    }
    if (!this.printPdf) {
      this.$el.focus()
      window.addEventListener('keydown', this.handleKeydown)
    }
    // PDF 모드 세팅
    if (this.printPdf) {
      document.body.classList.add('print-pdf')
      if (this.showNotes) {
        document.body.classList.add('show-notes')
        if (this.showNotes === 'separate-page') {
          document.body.classList.add('show-notes-separate-page')
        }
      }
      if (this.pdfSeparateFragments === 'false') {
        document.body.classList.add('separate-fragments')
      }
      setTimeout(() => {
        window.print()
      }, 1000)
    }
  },
  beforeUnmount() {
    if (!this.printPdf) {
      window.removeEventListener('keydown', this.handleKeydown)
    }
  },
  methods: {
    handleKeydown(e) {
      if (e.key === 'Escape') {
        window.location.href = '/'
      }
      // Other keyboard navigation is handled by reveal.js
    },
    openPdfExport() {
      if (this.$refs.pdfExportHelper) {
        this.$refs.pdfExportHelper.openModal()
      }
    },
    openPptxExport() {
      if (this.$refs.pptxExportHelper) {
        this.$refs.pptxExportHelper.openModal()
      }
    }
  }
}
</script>

<style>
.slide-presentation {
  height: 100vh;
  width: 100vw;
  background-color: #111;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  outline: none;
}

.slide-presentation.print-mode {
  background-color: #fff;
}

.presentation-controls {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 1rem;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  z-index: 100;
  opacity: 0.2;
  transition: opacity 0.3s;
}

.slide-presentation:hover .presentation-controls {
  opacity: 1;
}

.control-btn {
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  text-decoration: none;
  cursor: pointer;
  font-size: 0.9rem;
}

.slide-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.presentation-slide {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.empty-slide {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  background-color: white;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  width: 90vw;
  height: 80vh;
  max-width: 1200px;
  padding: 2rem;
  border-radius: 4px;
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
  margin-top: 1rem;
}

/* PDF Export Specific Styles */
body.print-pdf .presentation-controls {
  display: none;
}

@media print {
  .presentation-controls {
    display: none !important;
  }
  
  .slide-presentation {
    background-color: white !important;
  }
}
</style> 
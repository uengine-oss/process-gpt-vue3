<template>
  <div class="pptx-export-helper">
    <div class="modal" v-if="showModal">
      <div class="modal-content">
        <v-row class="ma-0 pa-4 align-center">
          <h3>{{ i18n.global.t('PptxExportHelper.title') }}</h3>
          <v-spacer></v-spacer>
          <v-btn @click="closeModal"
              icon variant="text"
              density="comfortable"
              style="margin-top:-8px;"
          >
              <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-row>
        <div class="modal-body">
          <p>{{ i18n.global.t('PptxExportHelper.configureOptions') }}</p>
          
          <div class="export-config">
            <div class="config-item">
              <label>
                <input type="checkbox" v-model="includeNotes">
                {{ i18n.global.t('PptxExportHelper.includeSpeakerNotes') }}
              </label>
            </div>
            
            <div class="config-item">
              <label>{{ i18n.global.t('PptxExportHelper.presentationName') }}:</label>
              <input 
                type="text" 
                v-model="fileName" 
                placeholder="presentation.pptx"
                class="text-input"
              />
            </div>
          </div>
          
          <div class="actions">
            <v-btn @click="exportToPptx"
              :color="themeColor" 
              variant="elevated" 
              class="rounded-pill"
              density="compact"
            >{{ i18n.global.t('PptxExportHelper.exportButton') }}
            </v-btn>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import pptxgen from 'pptxgenjs'
import { i18n } from '@/main'
import ThemeColorMixin from '@/components/ui/field/ThemeColorMixin.js'

export default {
  name: 'PptxExportHelper',
  mixins: [ThemeColorMixin],
  setup() {
    const showModal = ref(false)
    const includeNotes = ref(true)
    const fileName = ref('presentation.pptx')

    // Parse markdown content into slides
    const parseMarkdownSlides = (markdown) => {
      // Split horizontal slides
      const horizontalSlides = markdown.split(/^\n*---\n*$/gm)
      
      // Process each slide
      return horizontalSlides.map(slideContent => {
        // Check for vertical slides
        const verticalSlides = slideContent.split(/^\n*--\n*$/gm)
        
        // Process speaker notes
        const processSlide = (content) => {
          let slideText = content.trim()
          let notes = ''
          
          // Extract speaker notes if present
          const notesMatch = slideText.match(/Note:([\s\S]+?)(?=\n*$|^\n*--\n*|^\n*---\n*)/m)
          if (notesMatch) {
            notes = notesMatch[1].trim()
            // Remove notes from slide content
            slideText = slideText.replace(/Note:[\s\S]+?(?=\n*$|^\n*--\n*|^\n*---\n*)/m, '').trim()
          }
          
          return { content: slideText, notes }
        }
        
        // If there are vertical slides, process each one
        if (verticalSlides.length > 1) {
          return verticalSlides.map(processSlide)
        }
        
        // Single slide
        return [processSlide(verticalSlides[0])]
      })
    }

    const openModal = () => {
      showModal.value = true
    }

    const closeModal = () => {
      showModal.value = false
    }

    const exportToPptx = () => {
      // Get markdown content from localStorage
      const markdownContent = localStorage.getItem('markdownContent')
      
      if (!markdownContent) {
        alert('No presentation content found.')
        return
      }
      
      // Parse slides
      const slides = parseMarkdownSlides(markdownContent)
      
      // Create PowerPoint
      const pres = new pptxgen()
      
      // Set presentation properties
      pres.layout = 'LAYOUT_16x9'
      
      // Process each slide
      slides.forEach(slideGroup => {
        // Handle vertical slides
        slideGroup.forEach(slide => {
          // Create a new slide
          const pptSlide = pres.addSlide()
          
          // Get content and notes
          const { content, notes } = slide
          
          // Add slide content
          const lines = content.split('\n')
          let slideTitle = ''
          let slideBody = ''
          
          // Extract title from first line if it's a heading
          if (lines[0]?.startsWith('#')) {
            slideTitle = lines[0].replace(/^#+\s*/, '')
            lines.shift()
          }
          
          // Remaining content becomes the body
          slideBody = lines.join('\n')
          
          // Add title if present
          if (slideTitle) {
            pptSlide.addText(slideTitle, { 
              x: 0.5, 
              y: 0.5, 
              w: '90%',
              fontSize: 36,
              bold: true,
              color: '363636' 
            })
          }
          
          // Add body content
          if (slideBody) {
            pptSlide.addText(slideBody, { 
              x: 0.5, 
              y: slideTitle ? 1.5 : 0.5, 
              w: '90%',
              h: slideTitle ? 4 : 5,
              fontSize: 24,
              color: '363636' 
            })
          }
          
          // Add speaker notes if enabled
          if (includeNotes.value && notes) {
            pptSlide.addNotes(notes)
          }
        })
      })
      
      // Save the presentation
      pres.writeFile({ fileName: fileName.value || 'presentation.pptx' })
      
      // Close the modal
      closeModal()
    }

    return {
      i18n,
      showModal,
      includeNotes,
      fileName,
      openModal,
      closeModal,
      exportToPptx
    }
  }
}
</script>

<style>
.pptx-export-helper .modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.pptx-export-helper .modal-content {
  background-color: white;
  width: 90%;
  max-width: 500px;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
}

.pptx-export-helper .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
}

.pptx-export-helper .modal-header h3 {
  margin: 0;
}

.pptx-export-helper .close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #999;
}

.pptx-export-helper .modal-body {
  padding: 1rem;
}

.pptx-export-helper .export-config {
  margin: 1rem 0;
  padding: 1rem;
  background-color: #f8f8f8;
  border-radius: 4px;
}

.pptx-export-helper .config-item {
  margin-bottom: 1rem;
}

.pptx-export-helper .config-item label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
}

.pptx-export-helper .text-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.pptx-export-helper .actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.pptx-export-helper .action-btn {
  background-color: #42b883;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  margin-left: 0.5rem;
}

.pptx-export-helper .cancel-btn {
  background-color: #f1f1f1;
  color: #333;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 0.5rem;
}
</style> 
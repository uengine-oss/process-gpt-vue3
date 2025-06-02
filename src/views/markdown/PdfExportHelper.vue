<template>
  <div class="pdf-export-helper">
    <div class="modal" v-if="showModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>PDF Export Instructions</h3>
          <button @click="closeModal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <ol>
            <li>Click the "Prepare for PDF" button below</li>
            <li>Once the page reloads, press <strong>CTRL/CMD+P</strong> in your browser</li>
            <li>In the print dialog, set <strong>Destination</strong> to <strong>Save as PDF</strong></li>
            <li>Set <strong>Layout</strong> to <strong>Landscape</strong></li>
            <li>Set <strong>Margins</strong> to <strong>None</strong></li>
            <li>Enable <strong>Background graphics</strong> option</li>
            <li>Click <strong>Save</strong></li>
          </ol>
          <div class="pdf-config">
            <div class="config-item">
              <label>
                <input type="checkbox" v-model="showNotes">
                Include speaker notes
              </label>
            </div>
            <div class="config-item" v-if="showNotes">
              <label>
                <input type="radio" v-model="notesLayout" value="overlay">
                Overlay notes
              </label>
              <label>
                <input type="radio" v-model="notesLayout" value="separate-page">
                Separate page
              </label>
            </div>
            <div class="config-item">
              <label>
                <input type="checkbox" v-model="separateFragments">
                Separate fragments to different slides
              </label>
            </div>
          </div>
          <div class="actions">
            <v-btn color="primary" @click="preparePdfExport" >Prepare for PDF</v-btn>
            <v-btn color="secondary" @click="closeModal" >Cancel</v-btn>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  name: 'PdfExportHelper',
  emits: ['open-modal'],
  setup(props, { emit }) {
    const showModal = ref(false)
    const showNotes = ref(false)
    const notesLayout = ref('overlay')
    const separateFragments = ref(true)

    const openModal = () => {
      showModal.value = true
    }

    const closeModal = () => {
      showModal.value = false
    }

    const preparePdfExport = () => {
      // Create PDF export URL with appropriate query parameters
      let url = window.location.href

      // Check if we're already on the presentation page, if not, navigate to it
      if (!url.includes('/present')) {
        url = `${window.location.origin}/present`
      }

      // Add print-pdf parameter
      url = url.includes('?') ? `${url}&print-pdf` : `${url}?print-pdf`

      // Add speaker notes configuration if enabled
      if (showNotes.value) {
        url += `&showNotes=${notesLayout.value}`
      }

      // Add fragments configuration
      if (!separateFragments.value) {
        url += '&pdfSeparateFragments=false'
      }

      // Open in a new tab
      window.open(url, '_blank')
      
      // Close the modal
      closeModal()
    }

    return {
      showModal,
      showNotes,
      notesLayout,
      separateFragments,
      openModal,
      closeModal,
      preparePdfExport
    }
  }
}
</script>

<style>
.pdf-export-helper .modal {
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

.pdf-export-helper .modal-content {
  background-color: white;
  width: 90%;
  max-width: 600px;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
}

.pdf-export-helper .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #eee;
}

.pdf-export-helper .modal-header h3 {
  margin: 0;
  color: #42b883;
}

.pdf-export-helper .close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #999;
}

.pdf-export-helper .modal-body {
  padding: 1rem;
}

.pdf-export-helper .modal-body ol {
  margin-left: 1.5rem;
}

.pdf-export-helper .modal-body li {
  margin-bottom: 0.5rem;
}

.pdf-export-helper .pdf-config {
  margin: 1.5rem 0;
  padding: 1rem;
  background-color: #f8f8f8;
  border-radius: 4px;
}

.pdf-export-helper .config-item {
  margin-bottom: 0.8rem;
}

.pdf-export-helper .config-item label {
  margin-right: 1rem;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.pdf-export-helper .config-item input {
  margin-right: 0.5rem;
}

.pdf-export-helper .actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}

.pdf-export-helper .action-btn {
  background-color: #42b883;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  margin-left: 0.5rem;
}

.pdf-export-helper .cancel-btn {
  background-color: #f1f1f1;
  color: #333;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 0.5rem;
}
</style> 
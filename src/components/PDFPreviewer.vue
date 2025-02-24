<template>
  <div class="pdf-previewer" v-html="formattedHtml" style="height: 600px;">
  </div>
  <v-card-actions>
    <v-spacer></v-spacer>
    <v-btn color="primary" text @click="saveDocument()">{{ $t('PDFPreviewer.saveDocument') }}</v-btn>
    <v-btn color="error" text @click="closeDialog()">{{ $t('PDFPreviewer.close') }}</v-btn>
  </v-card-actions>
</template>

<script>
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

export default {
  name: 'PDFPreviewer',
  props: {
    element: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
        formattedHtml: ''
    };
  },
  created() {
  },
  mounted() {
    this.formatHtml();
  },
  methods: {
    formatHtml() {
        const element = this.element;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = element.innerHTML;

        const qlContainer = tempDiv.querySelector('.ql-container');
        if (qlContainer) {
            const parent = qlContainer.parentNode;
            while (qlContainer.firstChild) {
                parent.insertBefore(qlContainer.firstChild, qlContainer);
            }
            parent.removeChild(qlContainer);
        }
        const editorView = tempDiv.querySelector('.quill-editor-view-mode');
        if (editorView) {
            editorView.style.borderRadius = '10px';
            editorView.classList.add('ql-container', 'ql-snow');
        }

        const attachmentContainer = tempDiv.querySelector('.attachment-container');
        if (attachmentContainer) {
            const parent = attachmentContainer.parentNode;
            parent.removeChild(attachmentContainer);
        }

        tempDiv.querySelectorAll('button').forEach(button => button.remove());
        const html = tempDiv.innerHTML;
        this.formattedHtml = html;
        console.log(this.formattedHtml);
    },
    saveDocument() {
        if (!this.formattedHtml) {
            console.error("🚨 formattedHtml 값이 없습니다.");
            return;
        }

        // 1. 임시 컨테이너 생성
        const tempContainer = document.createElement("div");
        tempContainer.style.position = "absolute";
        tempContainer.style.left = "-9999px"; // 화면에서 숨기기
        tempContainer.innerHTML = this.formattedHtml; // formattedHtml 삽입
        document.body.appendChild(tempContainer);

        // 2. html2canvas로 캡처
        html2canvas(tempContainer, {
            scale: 2, // 해상도 향상
            // useCORS: true, // CORS 이미지 로드 허용
            allowTaint: true // 외부 리소스 허용
        }).then(canvas => {
            const imgData = canvas.toDataURL("image/png");

            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4",
            });

            const imgWidth = 210; // A4 Width (mm)
            const pageHeight = 297; // A4 Height (mm)
            const imgHeight = (canvas.height * imgWidth) / canvas.width; // 비율 유지
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position -= pageHeight;
                pdf.addPage();
                pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save("exported-document.pdf");

            console.log("📄 PDF 저장 완료 (formattedHtml 기반 변환)");

            // 3. 임시 DOM 삭제
            document.body.removeChild(tempContainer);
        }).catch(error => {
            console.error("❌ PDF 변환 중 오류 발생:", error);
        });
    },
    closeDialog() {
        this.$emit('closeDialog');
    }
  }
};
</script>

<style scoped>
/* Add your styles here */
</style>

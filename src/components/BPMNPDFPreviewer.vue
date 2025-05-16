<template>
    <div style="width: 110%; height: 800px; overflow: auto;">
      <div id="svgPreviews" style="margin-top: 0px; display: flex; flex-wrap: wrap;"></div>
    </div>
    <v-card-actions>
      <v-spacer></v-spacer>
    <v-btn color="primary" text @click="savePDF()">{{ $t('PDFPreviewer.saveDocument') }}</v-btn>
    <v-btn color="error" text @click="closeDialog()">{{ $t('PDFPreviewer.close') }}</v-btn>
  </v-card-actions>
  <div v-if="loading" class="overlay" style="background-color: rgba(0, 0, 0, 0.5); position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999;">
    <div style="background-color: white; padding: 20px; border-radius: 10px; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%;">
      <div style="text-align: center; margin-bottom: 20px;">
        <v-icon color="primary" size="48">mdi-file-pdf-box</v-icon>
        <p>{{ $t('PDFPreviewer.savingPDF') }}</p>
      </div>
      <v-progress-linear
        :model-value="progress"
        color="primary"
        style="width: 100%;"
      ></v-progress-linear>
    </div>
  </div>
</template>

<script>
import { jsPDF } from "jspdf";
import { toPng, toJpeg } from 'html-to-image';

export default {
  name: 'PDFPreviewer',
  props: {
    bpmnViewer: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
        formattedHtml: '',
        sections: {},
        tasks: [],
        loading: false,
        progress: 0
    };
  },
  created() {
  },
  mounted() {
    this.previewSVG();
  },
  methods: {
    closeDialog() {
        this.$emit('closeDialog');
    },
    previewSVG() {
        let self = this;
        this.bpmnViewer.saveSVG()
            .then(({ svg }) => {
                const previewsContainer = document.getElementById("svgPreviews");
                previewsContainer.innerHTML = ""; // 기존 내용 초기화

                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svg, "image/svg+xml");
                const originalSvg = svgDoc.documentElement;

                let viewBoxValues = originalSvg.getAttribute("viewBox").split(" ");
                let svgX = parseInt(viewBoxValues[0]); // 시작 x
                let svgY = parseInt(viewBoxValues[1]); // 시작 y
                let svgWidth = parseInt(viewBoxValues[2]); // 전체 너비
                let svgHeight = parseInt(viewBoxValues[3]); // 전체 높이

                let cropWidth = 1920;
                let cropHeight = 1200;
                let pageWidth = 1120;  // A4 너비
                let pageHeight = 800; // A4 높이
                let scale = Math.min(pageWidth / cropWidth, pageHeight / cropHeight);
                let displayWidth = cropWidth * scale;
                let displayHeight = cropHeight * scale;

                let pages = [];
                
                for (let y = svgY; y < svgY + svgHeight; y += cropWidth) {
                    for (let x = svgX; x < svgX + svgWidth; x += cropHeight) {
                        pages.push({ x, y });
                    }
                }

                pages.forEach(({ x, y }, index) => {
                    let newSvg = originalSvg.cloneNode(true);
                    newSvg.setAttribute("width", `${displayWidth}px`);
                    newSvg.setAttribute("height", `${displayHeight}px`);
                    newSvg.setAttribute("viewBox", `${x} ${y} ${cropWidth} ${cropHeight}`);
                    newSvg.style.border = "1px solid black"; // 경계선 표시
                    newSvg.style.background = "white";newSvg.setAttribute("preserveAspectRatio", "xMidYMid meet"); 

                    console.log(`🔹 Page ${index + 1} - ViewBox: ${x} ${y} ${pageWidth} ${pageHeight}`);

                    let pageDiv = document.createElement("div");
                    pageDiv.style.border = "1px solid #ccc";
                    pageDiv.style.margin = "10px";
                    pageDiv.style.padding = "10px";
                    pageDiv.style.display = "inline-block";
                    pageDiv.innerHTML = `<h3>Page ${index + 1}</h3>`;
                    pageDiv.appendChild(newSvg);
                    previewsContainer.appendChild(pageDiv);
                });

            })
            .catch((error) => {
                console.error("SVG 내보내기 중 오류 발생:", error);
            });
    },
    async savePDF() {
      this.loading = true;
      const name = this.bpmnViewer._definitions.name;
      const previewsContainer = document.getElementById("svgPreviews");
      if (!previewsContainer) {
          console.error("SVG 미리보기 컨테이너를 찾을 수 없습니다.");
          return;
      }

      const pdf = new jsPDF("p", "mm", "a4"); // A4 세로 방향 PDF 생성
      let pages = previewsContainer.children;
      let firstPage = true;

      for (let i = 0; i < pages.length; i++) {
          let pageDiv = pages[i];

          const imgData = await toJpeg(pageDiv, {
              quality: 0.8, // 🔥 품질 최적화
              cacheBust: true, // 캐시 문제 방지
              backgroundColor: "white",
          });

          const pdfWidth = 210;
          const pdfHeight = 297;
          const imgWidth = pdfWidth - 20;
          const imgHeight = (pageDiv.clientHeight / pageDiv.clientWidth) * imgWidth;

          if (!firstPage) {
              pdf.addPage();
          } else {
              firstPage = false;
          }
          pdf.addImage(imgData, "JPEG", 10, 10, imgWidth, imgHeight);
          this.progress = Math.round(((i + 1) / pages.length) * 100);
      }

      pdf.save(`${name}.pdf`);
      this.loading = false;
      this.progress = 0;
    }
  }
};
</script>

<style scoped>
/* Add your styles here */
</style>

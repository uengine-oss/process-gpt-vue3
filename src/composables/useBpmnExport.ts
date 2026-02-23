/**
 * BPMN Export Composable
 * PNG/PDF 내보내기 공통 유틸리티
 *
 * 사용 위치:
 * - /definitions/:id (ProcessDefinitionChat.vue)
 * - /definition-map/sub/:id (SubProcessDetail.vue)
 */

import { ref } from 'vue';

export interface BpmnExportOptions {
    /** 프로세스 이름 (PNG 타이틀에 표시) */
    processName?: string;
    /** bpmn-js viewer/modeler 인스턴스 */
    bpmnViewer: any;
}

export function useBpmnExport() {
    const isPreviewPDFDialog = ref(false);

    /**
     * PNG로 BPMN 다이어그램 다운로드
     * - SVG 직접 내보내기 (순수 BPMN 캔버스만)
     * - 상단에 프로세스 이름 표시
     * - 2배 해상도로 고품질 출력
     */
    async function capturePng(options: BpmnExportOptions): Promise<void> {
        const { bpmnViewer, processName = 'Process Diagram' } = options;

        if (!bpmnViewer) {
            console.error('BPMN viewer not found');
            return;
        }

        try {
            // SVG 직접 내보내기 (순수 BPMN 캔버스만)
            const { svg } = await bpmnViewer.saveSVG();

            // SVG 파싱하여 크기 추출
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svg, 'image/svg+xml');
            const svgElement = svgDoc.documentElement;

            // viewBox에서 실제 크기 추출
            const viewBox = svgElement.getAttribute('viewBox')?.split(' ').map(Number) || [0, 0, 800, 600];
            const [vbX, vbY, vbWidth, vbHeight] = viewBox;

            // 2배 해상도
            const scale = 2;
            const titleHeight = 50; // 타이틀 영역 높이
            const padding = 20;

            // 캔버스 생성 (타이틀 + BPMN)
            const canvas = document.createElement('canvas');
            canvas.width = vbWidth * scale;
            canvas.height = (vbHeight + titleHeight) * scale;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                console.error('Canvas context not available');
                return;
            }

            // 흰색 배경
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 프로세스 이름 그리기
            ctx.fillStyle = '#333';
            ctx.font = `bold ${24 * scale}px Arial, sans-serif`;
            ctx.textBaseline = 'middle';
            ctx.fillText(processName, padding * scale, (titleHeight / 2) * scale);

            // 구분선 그리기
            ctx.strokeStyle = '#e0e0e0';
            ctx.lineWidth = 1 * scale;
            ctx.beginPath();
            ctx.moveTo(0, titleHeight * scale);
            ctx.lineTo(canvas.width, titleHeight * scale);
            ctx.stroke();

            // SVG를 이미지로 변환
            const img = new Image();
            const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);

            img.onload = () => {
                // 타이틀 영역 아래에 BPMN 다이어그램 그리기
                ctx.drawImage(img, 0, titleHeight * scale, vbWidth * scale, vbHeight * scale);
                URL.revokeObjectURL(url);

                // PNG로 다운로드
                const dataUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `${processName}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };

            img.onerror = (error) => {
                console.error('SVG to PNG conversion failed:', error);
                URL.revokeObjectURL(url);
            };

            img.src = url;
        } catch (error) {
            console.error('PNG capture failed:', error);
        }
    }

    /**
     * PDF 미리보기 다이얼로그 열기
     */
    function openPdfPreview(): void {
        isPreviewPDFDialog.value = false;
        // nextTick 효과를 위해 setTimeout 사용
        setTimeout(() => {
            isPreviewPDFDialog.value = true;
        }, 0);
    }

    /**
     * PDF 미리보기 다이얼로그 닫기
     */
    function closePdfPreview(): void {
        isPreviewPDFDialog.value = false;
    }

    return {
        isPreviewPDFDialog,
        capturePng,
        openPdfPreview,
        closePdfPreview
    };
}

export default useBpmnExport;

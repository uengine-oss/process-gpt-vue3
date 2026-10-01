<template>
    <v-dialog :model-value="modelValue" max-width="1160" scrollable @update:model-value="$emit('update:modelValue', $event)">
        <v-card rounded="lg">
            <div class="d-flex align-center pr-2">
                <v-card-title class="text-h6">
                    <v-icon class="mr-2" color="primary">mdi-file-pdf-box</v-icon>
                    프로세스 정의서 PDF 내보내기
                </v-card-title>
                <v-btn icon variant="plain" class="ml-auto" @click="$emit('update:modelValue', false)">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </div>
            <v-card-text class="pdf-preview-scroll">
                <div ref="doc" class="pdf-doc">
                    <!-- 1. 표지 + 전체 프로세스 다이어그램 -->
                    <div class="pdf-block pdf-cover">
                        <div class="pdf-cover-title">{{ exportData.process.title || processName }}</div>
                        <div class="pdf-cover-subtitle">프로세스 정의서</div>
                    </div>
                    <div ref="diagramPages" class="pdf-diagram-pages"></div>

                    <!-- 2. 프로세스 설정 -->
                    <div class="pdf-block">
                        <div class="pdf-section-title">1. 프로세스 설정</div>
                        <table class="pdf-kv-table">
                            <tbody>
                                <tr>
                                    <th>프로세스명</th>
                                    <td>{{ exportData.process.title || processName }}</td>
                                </tr>
                                <tr v-if="exportData.process.owner">
                                    <th>담당자</th>
                                    <td>{{ exportData.process.owner }}</td>
                                </tr>
                                <tr v-if="exportData.process.description">
                                    <th>설명</th>
                                    <td class="pdf-pre">{{ exportData.process.description }}</td>
                                </tr>
                                <tr v-if="exportData.process.systems">
                                    <th>시스템</th>
                                    <td>{{ exportData.process.systems.join(', ') }}</td>
                                </tr>
                                <tr v-if="exportData.process.manualLinks">
                                    <th>관련자료</th>
                                    <td>
                                        <div v-for="(link, i) in exportData.process.manualLinks" :key="i">
                                            {{ link.name ? `${link.name} — ` : '' }}{{ link.url }}
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div v-if="exportData.process.ppi" class="pdf-block">
                        <div class="pdf-section-sub">PPI (프로세스 성과지표)</div>
                        <table class="pdf-grid-table">
                            <thead>
                                <tr>
                                    <th>지표명</th>
                                    <th>단위</th>
                                    <th>측정주기</th>
                                    <th>운영정의</th>
                                    <th>산출식</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(item, i) in exportData.process.ppi" :key="i">
                                    <td>{{ item.name }}</td>
                                    <td>{{ item.unit }}</td>
                                    <td>{{ item.cycle }}</td>
                                    <td>{{ item.definition }}</td>
                                    <td>{{ item.formula }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- 3. Lane / Task 설정 -->
                    <div class="pdf-block">
                        <div class="pdf-section-title">2. Lane / Task 설정</div>
                        <div v-if="!exportData.lanes.length" class="pdf-empty">표시할 Lane/Task가 없습니다.</div>
                    </div>
                    <template v-for="lane in exportData.lanes" :key="lane.id">
                        <div class="pdf-block pdf-lane-header">
                            <div class="pdf-lane-name">
                                <v-icon size="16" class="mr-1">mdi-arrow-split-horizontal</v-icon>
                                Lane — {{ lane.name }}
                            </div>
                            <div v-if="lane.description" class="pdf-lane-desc pdf-pre">{{ lane.description }}</div>
                            <div v-if="lane.assignment" class="pdf-lane-assign">
                                <span v-if="lane.assignment.resourceType" class="pdf-chip">
                                    유형: {{ resourceTypeLabel(lane.assignment.resourceType) }}
                                </span>
                                <span v-if="lane.assignment.assignees.length" class="pdf-chip">
                                    담당자: {{ lane.assignment.assignees.join(', ') }}
                                </span>
                                <span v-if="lane.assignment.organizations.length" class="pdf-chip">
                                    조직: {{ lane.assignment.organizations.join(', ') }}
                                </span>
                                <span v-if="lane.assignment.suppliers.length" class="pdf-chip">
                                    공급업체: {{ lane.assignment.suppliers.join(', ') }}
                                </span>
                            </div>
                        </div>
                        <div v-for="task in lane.tasks" :key="task.id" class="pdf-block pdf-task-card">
                            <div class="pdf-task-name">
                                <span v-if="task.taskCode" class="pdf-task-code">{{ task.taskCode }}</span>
                                {{ task.name }}
                                <span class="pdf-task-type">{{ shortType(task.type) }}</span>
                            </div>
                            <table class="pdf-kv-table pdf-kv-table-dense">
                                <tbody>
                                    <tr v-if="task.description">
                                        <th>설명</th>
                                        <td class="pdf-pre">{{ task.description }}</td>
                                    </tr>
                                    <tr v-if="task.raci">
                                        <th>RACI</th>
                                        <td>
                                            <div v-for="key in raciKeys" :key="key">
                                                <template v-if="task.raci[key].length">
                                                    <b>{{ key }}</b> ({{ raciLabel(key) }}): {{ task.raci[key].join(', ') }}
                                                </template>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr v-if="task.procedure">
                                        <th>업무 수행 절차</th>
                                        <td>
                                            <ol class="pdf-ol">
                                                <li v-for="(step, i) in task.procedure" :key="i">{{ step }}</li>
                                            </ol>
                                        </td>
                                    </tr>
                                    <tr v-if="task.inputs">
                                        <th>입력물</th>
                                        <td>{{ task.inputs.join(', ') }}</td>
                                    </tr>
                                    <tr v-if="task.outputs">
                                        <th>산출물</th>
                                        <td>{{ task.outputs.join(', ') }}</td>
                                    </tr>
                                    <tr v-if="task.dataInputs">
                                        <th>데이터 객체 입력</th>
                                        <td>{{ task.dataInputs.join(', ') }}</td>
                                    </tr>
                                    <tr v-if="task.dataOutputs">
                                        <th>데이터 객체 출력</th>
                                        <td>{{ task.dataOutputs.join(', ') }}</td>
                                    </tr>
                                    <tr v-if="task.formId">
                                        <th>폼 연결</th>
                                        <td>{{ formDisplay(task.formId) }}</td>
                                    </tr>
                                    <tr v-if="task.systems">
                                        <th>시스템</th>
                                        <td>{{ task.systems.join(', ') }}</td>
                                    </tr>
                                    <tr v-if="task.manualLinks">
                                        <th>관련자료</th>
                                        <td>
                                            <div v-for="(link, i) in task.manualLinks" :key="i">
                                                {{ link.name ? `${link.name} — ` : '' }}{{ link.url }}
                                            </div>
                                        </td>
                                    </tr>
                                    <tr v-if="task.apiIntegrations">
                                        <th>API 연동</th>
                                        <td>
                                            <div v-for="(api, i) in task.apiIntegrations" :key="i">
                                                {{ api.name }}<template v-if="api.url"> — {{ api.method }} {{ api.url }}</template>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr v-if="task.fte">
                                        <th>FTE</th>
                                        <td>{{ fteSummary(task.fte) }}</td>
                                    </tr>
                                    <tr v-if="task.opex">
                                        <th>OPEX</th>
                                        <td>
                                            {{ task.opex.cost.toLocaleString() }}원<template v-if="task.opex.unit"> / {{ task.opex.unit }}</template>
                                            <template v-if="task.opex.note"> ({{ task.opex.note }})</template>
                                        </td>
                                    </tr>
                                    <tr v-if="task.ppi">
                                        <th>PPI</th>
                                        <td>
                                            <div v-for="(item, i) in task.ppi" :key="i">
                                                {{ item.name }}<template v-if="item.unit"> ({{ item.unit }})</template>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr v-if="task.relatedProjects">
                                        <th>연관 과제</th>
                                        <td>{{ task.relatedProjects.join(', ') }}</td>
                                    </tr>
                                    <tr v-if="task.futureStatus">
                                        <th>Future Status</th>
                                        <td>{{ futureStatusLabel(task.futureStatus) }}</td>
                                    </tr>
                                    <tr v-if="task.mandatoryRule">
                                        <th>필수 Rule</th>
                                        <td>
                                            <div v-for="(rule, i) in task.mandatoryRule" :key="i">{{ rule }}</div>
                                        </td>
                                    </tr>
                                    <tr v-if="task.mail">
                                        <th>메일 발송</th>
                                        <td>
                                            <div v-if="task.mail.recipients">수신자: {{ task.mail.recipients.join(', ') }}</div>
                                            <div v-if="task.mail.title">제목: {{ task.mail.title }}</div>
                                            <div v-if="task.mail.contents" class="pdf-pre">내용: {{ task.mail.contents }}</div>
                                        </td>
                                    </tr>
                                    <tr v-if="task.linkedDefinitions">
                                        <th>연결 프로세스</th>
                                        <td>
                                            <div v-for="(defId, i) in task.linkedDefinitions" :key="i">
                                                {{ linkedDefinitionDisplay(defId) }}
                                            </div>
                                        </td>
                                    </tr>
                                    <tr v-for="field in task.customFields || []" :key="field.label">
                                        <th>{{ field.label }}</th>
                                        <td class="pdf-pre">{{ field.value }}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <div v-if="!hasTaskDetails(task)" class="pdf-empty">입력된 설정이 없습니다.</div>
                        </div>
                    </template>

                    <!-- 4. 통합 RACI -->
                    <div class="pdf-block">
                        <div class="pdf-section-title">3. 통합 RACI 매트릭스</div>
                        <div class="pdf-raci-legend">R=책임(수행) · A=승인 · S=지원 · C=자문 · I=통보</div>
                        <div v-if="!exportData.raci.orgs.length" class="pdf-empty">입력된 RACI가 없습니다.</div>
                        <table v-else class="pdf-grid-table pdf-raci-table">
                            <thead>
                                <tr>
                                    <th>Task</th>
                                    <th>역할(레인)</th>
                                    <th v-for="org in exportData.raci.orgs" :key="org">{{ org }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="row in exportData.raci.rows" :key="row.id">
                                    <td class="text-left">{{ row.name }}</td>
                                    <td>{{ row.laneName }}</td>
                                    <td v-for="org in exportData.raci.orgs" :key="org" :class="raciCellClass(row, org)">
                                        {{ raciCellValue(row, org) }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </v-card-text>
            <v-card-actions class="pa-4 pt-2">
                <v-spacer />
                <v-btn color="primary" variant="flat" :loading="saving" @click="savePDF">
                    <v-icon start>mdi-download</v-icon>
                    PDF 저장
                </v-btn>
                <v-btn variant="text" @click="$emit('update:modelValue', false)">닫기</v-btn>
            </v-card-actions>
            <v-overlay :model-value="saving" contained class="align-center justify-center" persistent>
                <v-card class="pa-6 text-center" min-width="320" rounded="lg">
                    <v-icon color="primary" size="48">mdi-file-pdf-box</v-icon>
                    <div class="text-body-2 my-3">PDF 문서를 생성하는 중입니다...</div>
                    <v-progress-linear :model-value="progress" color="primary" height="8" rounded />
                </v-card>
            </v-overlay>
        </v-card>
    </v-dialog>
</template>

<script>
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import { useBpmnStore } from '@/stores/bpmn';
import { useTaskCatalogStore } from '@/stores/taskCatalog';
import { collectProcessExportData, RACI_KEYS } from '@/utils/processExportData';
import BackendFactory from '@/components/api/BackendFactory';
import { formatIdentityWithTeam } from '@/utils/userIdentity';

const backend = BackendFactory.createBackend();

// A4 (mm)
const PAGE_MARGIN = 10;
const RACI_LABELS = { R: '책임', A: '승인', S: '지원', C: '자문', I: '통보' };
const RESOURCE_TYPE_LABELS = { internal: '내부', external: '외부(도급)', family: '관계사', role_group: '역할 그룹' };

export default {
    name: 'process-pdf-export-dialog',
    props: {
        modelValue: Boolean,
        processDefinition: { type: Object, default: null },
        processName: { type: String, default: '' },
        // CallActivity 연결 프로세스 id → 이름 해석용 (designer 의 definitionList prop 그대로)
        definitionList: { type: Array, default: () => [] }
    },
    emits: ['update:modelValue'],
    data() {
        return {
            exportData: { process: {}, lanes: [], raci: { rows: [], orgs: [] } },
            isHorizontal: true,
            saving: false,
            progress: 0,
            raciKeys: RACI_KEYS,
            // form_def id → 폼 이름 (폼 연결 표시용, 조회 실패 시 id 그대로)
            formNames: {}
        };
    },
    watch: {
        modelValue(open) {
            if (open) this.build();
        }
    },
    methods: {
        getModeler() {
            return useBpmnStore().getModeler;
        },
        async build() {
            const catalogStore = useTaskCatalogStore();
            // 가시성·커스텀 필드 판정에 쓰는 property_schema 가 아직 없으면 먼저 로드
            if (!catalogStore.schemasLoaded) {
                try {
                    await catalogStore.loadSchemas();
                } catch (e) {
                    /* 로드 실패 시 기본 노출(fail-open) 그대로 진행 */
                }
            }
            const isVisible = (taskType, key) => catalogStore.isBuiltinPropVisible(taskType, key);
            const getCustomSchemas = (elementType) => catalogStore.schemasByAppliesTo('task', elementType);
            this.exportData = collectProcessExportData(this.getModeler(), this.processDefinition, isVisible, getCustomSchemas);
            this.resolveOwnerName();
            this.resolveFormNames();
            this.$nextTick(() => this.buildDiagramPages());
        },
        // 폼 연결(formHandler:<form_def.id>) 표시용 이름 해석 — 실패해도 id 폴백으로 표시된다
        async resolveFormNames() {
            this.formNames = {};
            const formIds = new Set();
            this.exportData.lanes.forEach((lane) => lane.tasks.forEach((t) => t.formId && formIds.add(t.formId)));
            if (!formIds.size) return;
            try {
                const forms = (await backend.listDefinition('form_def')) || [];
                const map = {};
                forms.forEach((f) => {
                    const id = String(f?.id ?? '').trim();
                    if (id && formIds.has(id)) map[id] = String(f?.name ?? '').trim() || id;
                });
                this.formNames = map;
            } catch (e) {
                /* 목록 조회 실패 시 id 그대로 표시 */
            }
        },
        formDisplay(formId) {
            return this.formNames[formId] || formId;
        },
        linkedDefinitionDisplay(defId) {
            const def = (this.definitionList || []).find((d) => String(d?.file_name || d?.id || '').trim() === defId);
            const name = String(def?.name ?? '').trim();
            return name ? `${name} (${defId})` : defId;
        },
        futureStatusLabel(value) {
            const labels = { maintain: '유지', sunset: '폐기 예정', new: '신규', automation_planned: '자동화기획중' };
            return labels[value] || value;
        },
        // 담당자는 user id(UUID)/이메일로 저장되므로 표시용 이름으로 해석 (실패 시 원문 유지)
        async resolveOwnerName() {
            const owner = this.exportData.process.owner;
            if (!owner) return;
            try {
                const identityMap = await backend.resolveUserIdentities([owner]);
                const display = formatIdentityWithTeam(identityMap?.[owner], owner);
                if (display) this.exportData.process.owner = display;
            } catch (e) {
                /* 해석 실패 시 저장된 값 그대로 표시 */
            }
        },
        // BPMNPDFPreviewer 와 동일한 방식: saveSVG → 1920×1200 그리드로 잘라 페이지별 SVG clone
        async buildDiagramPages() {
            const container = this.$refs.diagramPages;
            if (!container) return;
            container.innerHTML = '';
            const modeler = this.getModeler();
            if (!modeler) return;
            try {
                const { svg } = await modeler.saveSVG();
                const parser = new DOMParser();
                const originalSvg = parser.parseFromString(svg, 'image/svg+xml').documentElement;
                const viewBoxValues = (originalSvg.getAttribute('viewBox') || '0 0 1920 1200').split(' ');
                const svgX = parseInt(viewBoxValues[0]);
                const svgY = parseInt(viewBoxValues[1]);
                const svgWidth = parseInt(viewBoxValues[2]);
                const svgHeight = parseInt(viewBoxValues[3]);

                this.isHorizontal = true;
                try {
                    const participants = modeler.get('elementRegistry').filter((el) => el.type === 'bpmn:Participant');
                    if (participants.length > 0) this.isHorizontal = !!participants[0].di.isHorizontal;
                } catch (e) {
                    /* 방향 판정 실패 시 horizontal 기본값 */
                }

                const cropWidth = this.isHorizontal ? 1920 : 1200;
                const cropHeight = this.isHorizontal ? 1200 : 1920;
                const displayWidth = 1040;
                const displayHeight = Math.round((displayWidth * cropHeight) / cropWidth);

                for (let y = svgY; y < svgY + svgHeight; y += cropHeight) {
                    for (let x = svgX; x < svgX + svgWidth; x += cropWidth) {
                        const pageSvg = originalSvg.cloneNode(true);
                        pageSvg.setAttribute('width', `${displayWidth}px`);
                        pageSvg.setAttribute('height', `${displayHeight}px`);
                        pageSvg.setAttribute('viewBox', `${x} ${y} ${cropWidth} ${cropHeight}`);
                        pageSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                        pageSvg.style.background = 'white';

                        const pageDiv = document.createElement('div');
                        pageDiv.className = 'pdf-block pdf-diagram-page';
                        pageDiv.appendChild(pageSvg);
                        container.appendChild(pageDiv);
                    }
                }
            } catch (error) {
                console.error('다이어그램 미리보기 생성 실패:', error);
            }
        },
        hasTaskDetails(task) {
            return !!(
                task.description ||
                task.raci ||
                task.procedure ||
                task.inputs ||
                task.outputs ||
                task.dataInputs ||
                task.dataOutputs ||
                task.formId ||
                task.systems ||
                task.manualLinks ||
                task.apiIntegrations ||
                task.fte ||
                task.opex ||
                task.ppi ||
                task.relatedProjects ||
                task.futureStatus ||
                task.mandatoryRule ||
                task.mail ||
                task.linkedDefinitions ||
                task.customFields
            );
        },
        shortType(type) {
            return String(type || '').replace('bpmn:', '');
        },
        raciLabel(key) {
            return RACI_LABELS[key] || key;
        },
        resourceTypeLabel(type) {
            return RESOURCE_TYPE_LABELS[type] || type;
        },
        fteSummary(fte) {
            if (fte.inputMode === 'percent' || (!fte.timePerTask && fte.directPercent)) {
                return `직접입력 ${fte.directPercent}%`;
            }
            const parts = [];
            if (fte.freqCycle) parts.push(`주기 ${fte.freqCycle} × ${fte.freqCount}회`);
            if (fte.timePerTask) parts.push(`건당 ${fte.timePerTask}시간`);
            if (fte.headcount) parts.push(`인원 ${fte.headcount}명`);
            return parts.join(', ');
        },
        raciCellValue(row, org) {
            return RACI_KEYS.filter((key) => row.raci[key].includes(org)).join(',');
        },
        raciCellClass(row, org) {
            const letters = RACI_KEYS.filter((key) => row.raci[key].includes(org));
            return letters.length === 1 ? `pdf-raci-${letters[0]}` : letters.length > 1 ? 'pdf-raci-multi' : '';
        },
        safeFileName() {
            const name = (this.exportData.process.title || this.processName || 'process').trim();
            return name.replace(/[\\/:*?"<>|]/g, '_');
        },
        loadImage(dataUrl) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = dataUrl;
            });
        },
        async savePDF() {
            const doc = this.$refs.doc;
            if (!doc) return;
            this.saving = true;
            this.progress = 0;
            try {
                const blocks = Array.from(doc.querySelectorAll('.pdf-block'));
                // 다이어그램 페이지는 방향에 맞춰 1블록=1페이지, 나머지 블록은 세로 A4에 흘려 담는다
                const pdf = new jsPDF(this.isHorizontal ? 'l' : 'p', 'mm', 'a4');
                let firstPage = true;
                let docPageStarted = false;
                let cursorY = PAGE_MARGIN;

                for (let i = 0; i < blocks.length; i++) {
                    const block = blocks[i];
                    const isDiagram = block.classList.contains('pdf-diagram-page');
                    const imgData = await toPng(block, { pixelRatio: 2, cacheBust: true, backgroundColor: 'white' });
                    const elemWidth = block.clientWidth || 1;
                    const elemHeight = block.clientHeight || 1;

                    if (isDiagram || block.classList.contains('pdf-cover')) {
                        // 전용 페이지 (표지·다이어그램) — 다이어그램 방향 유지
                        if (!firstPage) pdf.addPage('a4', this.isHorizontal ? 'l' : 'p');
                        firstPage = false;
                        docPageStarted = false;
                        const pageWidth = pdf.internal.pageSize.getWidth();
                        const pageHeight = pdf.internal.pageSize.getHeight();
                        const availableWidth = pageWidth - PAGE_MARGIN * 2;
                        const availableHeight = pageHeight - PAGE_MARGIN * 2;
                        const aspect = elemWidth / elemHeight;
                        let renderWidth = availableWidth;
                        let renderHeight = availableWidth / aspect;
                        if (renderHeight > availableHeight) {
                            renderHeight = availableHeight;
                            renderWidth = availableHeight * aspect;
                        }
                        pdf.addImage(imgData, 'PNG', (pageWidth - renderWidth) / 2, (pageHeight - renderHeight) / 2, renderWidth, renderHeight);
                    } else {
                        // 문서 블록 — 세로 페이지에 순서대로 채우고, 넘치면 새 페이지 / 한 페이지보다 크면 분할
                        if (!docPageStarted) {
                            if (!firstPage) pdf.addPage('a4', 'p');
                            firstPage = false;
                            docPageStarted = true;
                            cursorY = PAGE_MARGIN;
                        }
                        const pageWidth = pdf.internal.pageSize.getWidth();
                        const pageHeight = pdf.internal.pageSize.getHeight();
                        const availableWidth = pageWidth - PAGE_MARGIN * 2;
                        const availableHeight = pageHeight - PAGE_MARGIN * 2;
                        const renderWidth = availableWidth;
                        const renderHeight = (renderWidth * elemHeight) / elemWidth;

                        if (renderHeight <= availableHeight) {
                            if (cursorY + renderHeight > PAGE_MARGIN + availableHeight) {
                                pdf.addPage('a4', 'p');
                                cursorY = PAGE_MARGIN;
                            }
                            pdf.addImage(imgData, 'PNG', PAGE_MARGIN, cursorY, renderWidth, renderHeight);
                            cursorY += renderHeight + 3;
                        } else {
                            // 한 페이지를 넘는 블록: 이미지 픽셀을 페이지 높이 단위로 잘라 여러 페이지에 나눠 담는다
                            const image = await this.loadImage(imgData);
                            const chunkPx = Math.floor((availableHeight / renderHeight) * image.height);
                            if (cursorY > PAGE_MARGIN + 1) {
                                pdf.addPage('a4', 'p');
                                cursorY = PAGE_MARGIN;
                            }
                            let offset = 0;
                            let firstChunk = true;
                            while (offset < image.height) {
                                const sliceHeight = Math.min(chunkPx, image.height - offset);
                                const canvas = document.createElement('canvas');
                                canvas.width = image.width;
                                canvas.height = sliceHeight;
                                const ctx = canvas.getContext('2d');
                                ctx.fillStyle = 'white';
                                ctx.fillRect(0, 0, canvas.width, canvas.height);
                                ctx.drawImage(image, 0, offset, image.width, sliceHeight, 0, 0, image.width, sliceHeight);
                                const sliceData = canvas.toDataURL('image/png');
                                const sliceRenderHeight = (renderWidth * sliceHeight) / image.width;
                                if (!firstChunk) {
                                    pdf.addPage('a4', 'p');
                                }
                                pdf.addImage(sliceData, 'PNG', PAGE_MARGIN, PAGE_MARGIN, renderWidth, sliceRenderHeight);
                                cursorY = PAGE_MARGIN + sliceRenderHeight + 3;
                                offset += sliceHeight;
                                firstChunk = false;
                            }
                        }
                    }
                    this.progress = Math.round(((i + 1) / blocks.length) * 100);
                }

                pdf.save(`${this.safeFileName()}.pdf`);
                this.$toast?.success?.('PDF 문서를 저장했습니다.');
            } catch (error) {
                console.error('PDF 생성 실패:', error);
                this.$toast?.error?.('PDF 생성 중 오류가 발생했습니다. 다시 시도해 주세요.');
            } finally {
                this.saving = false;
                this.progress = 0;
            }
        }
    }
};
</script>

<style scoped>
.pdf-preview-scroll {
    background: #eceff1;
    max-height: calc(100vh - 220px);
}
.pdf-doc {
    width: 1080px;
    max-width: 100%;
    margin: 0 auto;
    background: white;
    color: #1a1a1a;
    padding: 24px 20px;
}
.pdf-block {
    padding: 8px 0;
}
.pdf-cover {
    text-align: center;
    padding: 48px 0 32px;
    border-bottom: 2px solid #1a237e;
    margin-bottom: 12px;
}
.pdf-cover-title {
    font-size: 30px;
    font-weight: 700;
}
.pdf-cover-subtitle {
    font-size: 15px;
    color: #555;
    margin-top: 8px;
    letter-spacing: 4px;
}
.pdf-doc :deep(.pdf-diagram-page) {
    border: 1px solid #ddd;
    margin: 8px 0;
    padding: 8px;
    background: white;
    text-align: center;
}
.pdf-section-title {
    font-size: 19px;
    font-weight: 700;
    border-left: 5px solid #1a237e;
    padding-left: 10px;
    margin: 14px 0 10px;
}
.pdf-section-sub {
    font-size: 15px;
    font-weight: 600;
    margin: 4px 0 6px;
}
.pdf-kv-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}
.pdf-kv-table th {
    width: 140px;
    background: #f4f6f8;
    text-align: left;
    vertical-align: top;
    font-weight: 600;
}
.pdf-kv-table th,
.pdf-kv-table td {
    border: 1px solid #d7dbe0;
    padding: 7px 10px;
}
.pdf-kv-table-dense th {
    width: 120px;
}
.pdf-grid-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
}
.pdf-grid-table th,
.pdf-grid-table td {
    border: 1px solid #d7dbe0;
    padding: 6px 8px;
    text-align: center;
}
.pdf-grid-table th {
    background: #f4f6f8;
    font-weight: 600;
}
.pdf-lane-header {
    background: #eef1f8;
    border: 1px solid #c9d0e4;
    border-radius: 6px;
    padding: 10px 14px;
    margin-top: 14px;
}
.pdf-lane-name {
    font-size: 15px;
    font-weight: 700;
    color: #1a237e;
}
.pdf-lane-desc {
    font-size: 13px;
    color: #444;
    margin-top: 4px;
}
.pdf-lane-assign {
    margin-top: 6px;
}
.pdf-chip {
    display: inline-block;
    background: white;
    border: 1px solid #c9d0e4;
    border-radius: 10px;
    font-size: 12px;
    padding: 2px 10px;
    margin: 2px 6px 2px 0;
}
.pdf-task-card {
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 10px 14px;
    margin: 8px 0 8px 14px;
}
.pdf-task-name {
    font-size: 14px;
    font-weight: 700;
    margin-bottom: 6px;
}
.pdf-task-type {
    font-size: 11px;
    font-weight: 400;
    color: #888;
    margin-left: 6px;
}
.pdf-task-code {
    display: inline-block;
    background: #eef1f8;
    border: 1px solid #c9d0e4;
    border-radius: 4px;
    color: #1a237e;
    font-size: 11px;
    padding: 1px 6px;
    margin-right: 4px;
    vertical-align: 1px;
}
.pdf-ol {
    margin: 0;
    padding-left: 18px;
}
.pdf-pre {
    white-space: pre-wrap;
}
.pdf-empty {
    font-size: 13px;
    color: #888;
    padding: 4px 0;
}
.pdf-raci-legend {
    font-size: 12px;
    color: #666;
    margin-bottom: 6px;
}
.pdf-raci-table td {
    font-weight: 700;
}
.pdf-raci-table td.text-left {
    text-align: left;
    font-weight: 400;
}
.pdf-raci-R {
    background: rgba(211, 47, 47, 0.12);
    color: #c62828;
}
.pdf-raci-A {
    background: rgba(48, 63, 159, 0.12);
    color: #283593;
}
.pdf-raci-S {
    background: rgba(46, 125, 50, 0.12);
    color: #2e7d32;
}
.pdf-raci-C {
    background: rgba(239, 108, 0, 0.12);
    color: #e65100;
}
.pdf-raci-I {
    background: rgba(97, 97, 97, 0.12);
    color: #616161;
}
.pdf-raci-multi {
    background: rgba(123, 31, 162, 0.12);
    color: #6a1b9a;
}
</style>

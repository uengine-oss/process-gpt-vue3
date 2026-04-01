<template>
    <div
        class="bpmn-pdf-preview-scroll"
        style="width: 100%; max-width: min(720px, 100%); margin: 0 auto; max-height: min(72vh, 820px); min-height: 280px; overflow: auto; box-sizing: border-box; padding: 0 4px"
    >
        <div
            id="svgPreviews"
            style="display: flex; flex-direction: column; align-items: center; width: 100%; gap: 6px; padding: 0 0 4px"
        ></div>
        <!-- PAL 전체저장: 미리보기 전용 — 세로 스택(BPMN 아래로 태스크 매뉴얼) -->
        <div
            v-if="includePalManuals"
            id="palManualPreviews"
            style="display: flex; flex-direction: column; align-items: center; width: 100%; gap: 6px; padding: 0 0 8px"
        ></div>
    </div>
    <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" text @click="savePDF()">{{ $t('PDFPreviewer.saveDocument') }}</v-btn>
        <v-btn color="error" text @click="closeDialog()">{{ $t('PDFPreviewer.close') }}</v-btn>
    </v-card-actions>
    <div
        v-if="loading"
        class="overlay"
        style="background-color: rgba(0, 0, 0, 0.5); position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999"
    >
        <div
            style="
                background-color: white;
                padding: 20px;
                border-radius: 10px;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 80%;
            "
        >
            <div style="text-align: center; margin-bottom: 20px">
                <v-icon color="primary" size="48">mdi-file-pdf-box</v-icon>
                <p>{{ $t('PDFPreviewer.savingPDF') }}</p>
            </div>
            <v-progress-linear :model-value="progress" color="primary" style="width: 100%"></v-progress-linear>
        </div>
    </div>
</template>

<script>
import { jsPDF } from 'jspdf';
import { toPng, toCanvas } from 'html-to-image';

/** BPMN/PAL PDF 미리보기·캡처 가로(px). 속성 패널 PDF 열과 동일; 다이얼로그 max-width는 이에 맞게 BpmnUengine에서 제한 */
const BPMN_PDF_COLUMN_PX = 720;
/** 미리보기/PDF 한 페이지에 넣을 BPMN 조각의 최대 높이(px). 너비는 항상 전체(viewBox width) 유지 */
const BPMN_MAX_PAGE_DISPLAY_HEIGHT_PX = 1200;
/** PAL 매뉴얼 본문(ql-editor) 한 ‘페이지’에 허용하는 최대 높이(px). 초과 시 다음 페이지로 분할 */
const PAL_MANUAL_DESC_CHUNK_MAX_HEIGHT_PX = 880;

/**
 * bpmn-js saveSVG() 결과의 viewBox에는 캔버스 여백이 많이 포함되는 경우가 있어,
 * 실제 도형 경계(getBBox)에 맞춰 viewBox를 조이면 미리보기/PDF에서 좌우 빈 여백이 줄어든다.
 */
function tightenSvgExportViewBox(originalSvg, vbX, vbY, vbW, vbH) {
    const clone = originalSvg.cloneNode(true);
    clone.setAttribute('width', String(vbW));
    clone.setAttribute('height', String(vbH));
    clone.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
    const holder = document.createElement('div');
    holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText =
        'position:fixed;left:-99999px;top:0;width:1px;height:1px;overflow:hidden;visibility:hidden;pointer-events:none;margin:0;padding:0;border:0;';
    document.body.appendChild(holder);
    holder.appendChild(clone);
    let bbox;
    try {
        bbox = clone.getBBox();
    } catch {
        bbox = null;
    }
    holder.removeChild(clone);
    document.body.removeChild(holder);

    if (!bbox || bbox.width <= 0 || bbox.height <= 0 || !Number.isFinite(bbox.x + bbox.y + bbox.width + bbox.height)) {
        return { x: vbX, y: vbY, width: vbW, height: vbH };
    }

    const pad = Math.max(24, Math.min(vbW, vbH) * 0.006);
    let nx = Math.max(vbX, bbox.x - pad);
    let ny = Math.max(vbY, bbox.y - pad);
    const rx = Math.min(vbX + vbW, bbox.x + bbox.width + pad);
    const by = Math.min(vbY + vbH, bbox.y + bbox.height + pad);
    let nw = rx - nx;
    let nh = by - ny;
    if (nw <= 1 || nh <= 1) {
        return { x: vbX, y: vbY, width: vbW, height: vbH };
    }

    const shrinkW = vbW - nw;
    const shrinkH = vbH - nh;
    if (shrinkW < vbW * 0.005 && shrinkH < vbH * 0.005) {
        return { x: vbX, y: vbY, width: vbW, height: vbH };
    }

    return { x: nx, y: ny, width: nw, height: nh };
}

export default {
    name: 'PDFPreviewer',
    props: {
        bpmnViewer: {
            type: Object,
            required: true
        },
        /** PAL: processDefinition.activities 매뉴얼 페이지를 BPMN PDF 뒤에 추가 */
        includePalManuals: {
            type: Boolean,
            default: false
        },
        processDefinition: {
            type: Object,
            default: null
        }
    },
    data() {
        return {
            formattedHtml: '',
            sections: {},
            tasks: [],
            loading: false,
            progress: 0,
            // BPMN 다이어그램의 방향(가로 / 세로)
            isHorizontal: true
        };
    },
    created() {},
    mounted() {
        this.previewSVG();
    },
    watch: {
        includePalManuals() {
            this.previewSVG();
        },
        processDefinition: {
            deep: true,
            handler() {
                if (this.includePalManuals) this.previewSVG();
            }
        }
    },
    methods: {
        closeDialog() {
            this.$emit('closeDialog');
        },
        /** activities가 배열 또는 id→activity 맵으로 올 수 있음 */
        normalizeActivities(pd) {
            if (!pd || pd.activities == null) return [];
            const a = pd.activities;
            if (Array.isArray(a)) return a.filter((x) => x != null);
            if (typeof a === 'object') return Object.values(a).filter((x) => x != null);
            return [];
        },
        parseUengineJsonFromBo(bo) {
            if (!bo || !bo.extensionElements || !bo.extensionElements.values?.length) return {};
            const vals = bo.extensionElements.values;
            let uengineProps = vals.find((v) => v.$type === 'uengine:Properties');
            if (!uengineProps && vals[0] && vals[0].json != null) {
                uengineProps = vals[0];
            }
            if (!uengineProps || !uengineProps.json) return {};
            try {
                return JSON.parse(uengineProps.json);
            } catch {
                return {};
            }
        },
        /**
         * checkpoints vs checkPoints(채팅/AI 등) 별칭, 문자열 단일 값.
         * 둘 중 비어 있지 않은 쪽을 우선(빈 배열이면 다른 키 시도).
         */
        normalizeCheckpointsRawFromProps(props) {
            if (!props || typeof props !== 'object') return [];
            const a = props.checkpoints;
            const b = props.checkPoints;
            const arrA = Array.isArray(a) ? a : typeof a === 'string' && String(a).trim() ? [a] : null;
            const arrB = Array.isArray(b) ? b : typeof b === 'string' && String(b).trim() ? [b] : null;
            if (arrA && arrA.length) return arrA;
            if (arrB && arrB.length) return arrB;
            if (Array.isArray(a)) return a;
            if (Array.isArray(b)) return b;
            return [];
        },
        /** checkpoints / checkPoints 별칭만 정리. 업무 링크(taskLink)는 사용자 입력 그대로 둔다. */
        normalizePalManualEntry(entry) {
            if (!entry) return entry;
            const rawCps = this.normalizeCheckpointsRawFromProps(entry);
            const baseCps = rawCps.length ? rawCps : Array.isArray(entry.checkpoints) ? [...entry.checkpoints] : [];
            return {
                ...entry,
                checkpoints: baseCps,
                taskLink: String(entry.taskLink || '').trim()
            };
        },
        getLaneNameForShape(element) {
            let el = element;
            let depth = 0;
            while (el && depth++ < 24) {
                if (el.type === 'bpmn:Lane') {
                    const bo = el.businessObject;
                    return (bo && (bo.name || bo.id)) || '';
                }
                el = el.parent;
            }
            return '';
        },
        /**
         * PAL 매뉴얼은 uEngine에서 주로 BPMN extension(uengine:Properties)에 저장됨.
         * processDefinition.activities만으로는 비어 있는 경우가 많음 → 다이어그램에서 수집.
         */
        collectPalManualEntriesFromDiagram() {
            const viewer = this.bpmnViewer;
            if (!viewer || typeof viewer.get !== 'function') return [];
            let elementRegistry;
            try {
                elementRegistry = viewer.get('elementRegistry');
            } catch {
                return [];
            }
            const all = elementRegistry.getAll();
            const rows = [];
            for (const el of all) {
                if (!el || el.type === 'label') continue;
                const t = el.type || '';
                if (!t.includes('Task') && t !== 'bpmn:CallActivity') continue;
                const bo = el.businessObject;
                if (!bo || !bo.id) continue;
                const props = this.parseUengineJsonFromBo(bo);
                const name = bo.name || bo.id;
                const roleName = this.getLaneNameForShape(el);
                const description = props.description || '';
                const checkpoints = this.normalizeCheckpointsRawFromProps(props);
                const taskLink = String(props.taskLink || '').trim();
                rows.push({
                    id: bo.id,
                    name,
                    roleName,
                    description,
                    checkpoints,
                    taskLink,
                    _sortY: typeof el.y === 'number' ? el.y : 0,
                    _sortX: typeof el.x === 'number' ? el.x : 0
                });
            }
            rows.sort((a, b) => {
                if (a._sortY !== b._sortY) return a._sortY - b._sortY;
                return a._sortX - b._sortX;
            });
            return rows.map(({ _sortY, _sortX, ...rest }) => rest);
        },
        mergeRoleFromPd(act) {
            if (act && act.role) {
                if (typeof act.role === 'object') return act.role.name || '';
                return String(act.role);
            }
            return '';
        },
        /** 다이어그램 우선 + processDefinition.activities로 보강 */
        resolvePalManualEntries() {
            const fromDiagram = this.collectPalManualEntriesFromDiagram();
            const pdActs = this.normalizeActivities(this.processDefinition);
            const byId = new Map();

            for (const row of fromDiagram) {
                byId.set(row.id, { ...row });
            }
            for (const act of pdActs) {
                if (!act || !act.id) continue;
                const cur = byId.get(act.id);
                if (cur) {
                    if (!cur.description && act.description) cur.description = act.description;
                    const actCps = this.normalizeCheckpointsRawFromProps(act);
                    if (!this.normalizeCheckpointsForPdf(cur.checkpoints || []).length && actCps.length) {
                        cur.checkpoints = actCps;
                    }
                    if (!cur.taskLink && act.taskLink) cur.taskLink = act.taskLink;
                    if (!cur.name && act.name) cur.name = act.name;
                    if (!cur.roleName) cur.roleName = this.mergeRoleFromPd(act);
                } else {
                    byId.set(act.id, {
                        id: act.id,
                        name: act.name || act.id,
                        roleName: this.mergeRoleFromPd(act),
                        description: act.description || '',
                        checkpoints: this.normalizeCheckpointsRawFromProps(act),
                        taskLink: act.taskLink || ''
                    });
                }
            }

            const ordered = [];
            const seen = new Set();
            for (const d of fromDiagram) {
                const m = byId.get(d.id);
                if (m) {
                    ordered.push(m);
                    seen.add(d.id);
                }
            }
            for (const [id, m] of byId) {
                if (!seen.has(id)) ordered.push(m);
            }
            return ordered.map((e) => this.normalizePalManualEntry(e));
        },
        shouldSkipPalEntry(entry) {
            const title = (entry.name || entry.id || '').trim();
            return !title;
        },
        sanitizeHtmlForPdf(html) {
            if (!html || typeof html !== 'string') return '';
            try {
                const d = document.createElement('div');
                d.innerHTML = html;
                d.querySelectorAll('script').forEach((s) => s.remove());
                return d.innerHTML;
            } catch {
                return '';
            }
        },
        normalizeCheckpointsForPdf(checkpoints) {
            if (!Array.isArray(checkpoints)) return [];
            return checkpoints
                .map((c) => {
                    if (c == null) return '';
                    if (typeof c === 'object' && c.checkpoint !== undefined) return String(c.checkpoint || '');
                    return String(c);
                })
                .filter((s) => String(s).trim());
        },
        /** ql-editor 내부 HTML만 동일 폭으로 측정(미리보기/PDF 분할 높이 기준) */
        measurePalDescriptionSliceHeight(innerHtml) {
            const w = BPMN_PDF_COLUMN_PX;
            const root = document.createElement('div');
            root.setAttribute('aria-hidden', 'true');
            root.style.cssText = `position:fixed;left:-99999px;top:0;width:${w}px;visibility:hidden;pointer-events:none;`;
            const outer = document.createElement('div');
            outer.className = 'pdf-previewer-pal-manual';
            outer.style.cssText = `width:100%;max-width:${w}px;box-sizing:border-box;font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif;`;
            const pad = document.createElement('div');
            pad.style.cssText = 'padding:6px 10px 2px;';
            const qlContainer = document.createElement('div');
            qlContainer.className = 'quill-editor-view-mode ql-container ql-snow';
            qlContainer.style.cssText =
                'border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;min-height:40px;background:#fff;';
            const qlEditor = document.createElement('div');
            qlEditor.className = 'ql-editor';
            qlEditor.style.cssText = 'padding:0;line-height:1.5;font-size:13px;color:#1e293b;';
            qlEditor.innerHTML = innerHtml;
            qlContainer.appendChild(qlEditor);
            pad.appendChild(qlContainer);
            outer.appendChild(pad);
            root.appendChild(outer);
            document.body.appendChild(root);
            const h = qlEditor.scrollHeight;
            document.body.removeChild(root);
            return h;
        },
        /** 단일 블록이 너무 길면 innerHTML을 이진 분할해 여러 조각으로 나눔 */
        splitOversizedDescriptionBlockHtml(outerHtml, maxPx) {
            const measure = (inner) => this.measurePalDescriptionSliceHeight(inner);
            if (measure(outerHtml) <= maxPx) return [outerHtml];
            const d = document.createElement('div');
            d.innerHTML = outerHtml;
            const el = d.firstElementChild;
            if (!el || !(el.innerHTML || '').trim() || String(el.innerHTML).length < 32) {
                return [outerHtml];
            }
            const inner = el.innerHTML;
            let lo = 1;
            let hi = inner.length;
            let best = 1;
            while (lo <= hi) {
                const mid = Math.floor((lo + hi) / 2);
                const part = inner.slice(0, mid);
                const testEl = el.cloneNode(false);
                testEl.innerHTML = part;
                const wrap = document.createElement('div');
                wrap.appendChild(testEl);
                if (measure(wrap.innerHTML) <= maxPx) {
                    best = mid;
                    lo = mid + 1;
                } else hi = mid - 1;
            }
            const part1 = inner.slice(0, best).trim();
            const part2 = inner.slice(best).trim();
            const out = [];
            if (part1) {
                const e1 = el.cloneNode(false);
                e1.innerHTML = part1;
                const w1 = document.createElement('div');
                w1.appendChild(e1);
                const h1 = w1.innerHTML;
                out.push(...(measure(h1) > maxPx ? this.splitOversizedDescriptionBlockHtml(h1, maxPx) : [h1]));
            }
            if (part2) {
                const e2 = el.cloneNode(false);
                e2.innerHTML = part2;
                const w2 = document.createElement('div');
                w2.appendChild(e2);
                const h2 = w2.innerHTML;
                out.push(...(measure(h2) > maxPx ? this.splitOversizedDescriptionBlockHtml(h2, maxPx) : [h2]));
            }
            return out.length ? out : [outerHtml];
        },
        /**
         * 설명 HTML을 높이 기준으로 여러 ‘페이지’ 조각으로 분할.
         * @returns {string[]} ql-editor에 넣을 innerHTML 조각들
         */
        splitPalDescriptionHtmlIntoChunks(descriptionHtml) {
            const maxPx = PAL_MANUAL_DESC_CHUNK_MAX_HEIGHT_PX;
            const measure = (inner) => this.measurePalDescriptionSliceHeight(inner);
            const safe = this.sanitizeHtmlForPdf(descriptionHtml || '');
            const inner = safe && String(safe).trim() ? safe : '<p><br></p>';
            if (measure(inner) <= maxPx) return [inner];

            const wrapper = document.createElement('div');
            wrapper.innerHTML = inner;
            const blocks = [];
            for (const n of Array.from(wrapper.childNodes)) {
                if (n.nodeType === 1) blocks.push(n);
                else if (n.nodeType === 3 && String(n.textContent || '').trim()) {
                    const p = document.createElement('p');
                    p.appendChild(n.cloneNode(true));
                    blocks.push(p);
                }
            }
            if (blocks.length === 0) {
                const shell = document.createElement('div');
                shell.innerHTML = inner;
                const outer =
                    shell.children.length === 1
                        ? shell.children[0].outerHTML
                        : `<div>${shell.innerHTML}</div>`;
                return this.splitOversizedDescriptionBlockHtml(outer, maxPx);
            }

            const chunks = [];
            let acc = [];
            for (const block of blocks) {
                const one = block.outerHTML;
                if (measure(one) > maxPx) {
                    if (acc.length) {
                        chunks.push(acc.map((b) => b.outerHTML).join(''));
                        acc = [];
                    }
                    chunks.push(...this.splitOversizedDescriptionBlockHtml(one, maxPx));
                    continue;
                }
                const testHtml = [...acc, block].map((b) => b.outerHTML).join('');
                if (measure(testHtml) <= maxPx || acc.length === 0) {
                    acc.push(block);
                } else {
                    chunks.push(acc.map((b) => b.outerHTML).join(''));
                    acc = [block];
                }
            }
            if (acc.length) chunks.push(acc.map((b) => b.outerHTML).join(''));
            return chunks.length ? chunks : [inner];
        },
        /**
         * BpmnPropertyPanel + PALUserTaskPanel + PDFPreviewer(속성 패널 PDF)와 동일한 매뉴얼 레이아웃.
         * — view-mode 헤더(태스크명), 역할, Quill 본문 박스, 체크포인트(✔), 업무 링크
         * @param {object} [options]
         * @param {string|null} [options.descriptionOverride] ql-editor에 넣을 HTML(분할 페이지용)
         * @param {boolean} [options.continuation] 이전 페이지에 이어지는 본문
         * @param {boolean} [options.showCheckpoints] 체크포인트 블록 표시(마지막 페이지만 true 권장)
         * @param {boolean} [options.showLink] 업무 링크 표시(마지막 페이지만 true 권장)
         */
        buildPalTaskManualBlockHtml(pageNum, entry, options = {}) {
            if (typeof entry === 'string') {
                entry = { name: entry, id: '', description: '', roleName: '', checkpoints: [], taskLink: '' };
            }
            const descriptionOverride = options.descriptionOverride;
            const continuation = !!options.continuation;
            const showCheckpoints = options.showCheckpoints !== false;
            const showLink = options.showLink !== false;

            const pageWord = this.escapeHtml(this.$t('PDFPreviewer.pageLabel'));
            const contWord = this.escapeHtml(this.$t('PDFPreviewer.taskManualContinued'));
            const safeTitle = this.escapeHtml(entry.name || entry.id || '');
            const titleLine = continuation ? `${safeTitle} (${contWord})` : safeTitle;
            const roleLabel = this.escapeHtml(this.$t('BpmnPropertyPanel.role'));
            const checkpointsHeading = this.escapeHtml(this.$t('BpmnPropertyPanel.checkPoints'));
            const linkLabel = this.escapeHtml(this.$t('PALUserTaskPanel.taskLink'));

            const roleName = String(entry.roleName || '').trim();
            const roleBlock =
                !continuation && roleName
                    ? `<div class="property-panel-label-block" style="padding:4px 10px 0;margin-bottom:0;"><div class="role-label" style="margin-bottom:2px;font-size:13px;color:#374151;">${roleLabel}: ${this.escapeHtml(roleName)}</div></div>`
                    : '';

            const descRaw =
                descriptionOverride !== undefined && descriptionOverride !== null
                    ? this.sanitizeHtmlForPdf(String(descriptionOverride))
                    : this.sanitizeHtmlForPdf(entry.description || '');
            const descInner = descRaw && String(descRaw).trim() ? descRaw : '<p><br></p>';

            const cps = this.normalizeCheckpointsForPdf(entry.checkpoints);
            let cpRows = '';
            cps.forEach((text) => {
                const t = this.escapeHtml(text);
                cpRows += `<div style="margin-bottom:4px;"><div style="display:flex;align-items:flex-start;padding:4px 8px;"><span style="color:rgb(99,102,241);margin-right:8px;font-size:14px;line-height:1.4;">✔</span><div style="font-weight:700;font-size:14px;line-height:1.4;">${t}</div></div></div>`;
            });
            const cpBoxInner =
                cpRows ||
                '<div style="min-height:16px;color:#cbd5e1;font-size:12px;">&nbsp;</div>';

            const link = String(entry.taskLink || '').trim();
            const linkBlock =
                showLink && link
                    ? `<div style="padding:0 10px 8px;font-size:13px;word-break:break-all;line-height:1.45;"><span style="font-weight:600;">${linkLabel}:</span> <a href="${this.escapeHtml(link)}" style="color:rgb(99,102,241);">${this.escapeHtml(link)}</a></div>`
                    : '';

            const checkpointsSection = showCheckpoints
                ? `<div style="padding:2px 10px 8px;">
                        <h6 class="text-body-1" style="font-size:0.9rem;font-weight:500;margin:0 0 4px;color:#1e293b;">${checkpointsHeading}</h6>
                        <div class="check-points-field-box" style="border:1px solid lightgray;border-radius:8px;padding:6px;background:#fff;">${cpBoxInner}</div>
                    </div>`
                : '';

            return `
                <div class="pdf-previewer-pal-manual" style="width:100%;max-width:${BPMN_PDF_COLUMN_PX}px;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#fff;font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif;">
                    <div style="font-size:11px;color:#64748b;padding:5px 10px 4px;background:#fafafa;border-bottom:1px solid #f1f5f9;">${pageWord} ${pageNum}</div>
                    <div style="background:linear-gradient(to right,#f8fafc,#ffffff);border-bottom:1px solid #e2e8f0;padding:6px 10px;min-height:32px;display:flex;align-items:center;font-size:13px;font-weight:600;color:#1e293b;line-height:1.2;">${titleLine}</div>
                    ${roleBlock}
                    <div style="padding:6px 10px 2px;">
                        <div class="quill-editor-view-mode ql-container ql-snow" style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;min-height:40px;background:#fff;">
                            <div class="ql-editor" style="padding:0;line-height:1.5;font-size:13px;color:#1e293b;">${descInner}</div>
                        </div>
                    </div>
                    ${checkpointsSection}
                    ${linkBlock}
                </div>
            `;
        },
        /** PDFPreviewer.formatHtml 과 동일: 버튼 제거 등(동적 삽입 DOM용) */
        applyPdfPreviewerLikeDomCleanup(rootEl) {
            if (!rootEl || !rootEl.querySelectorAll) return;
            rootEl.querySelectorAll('button').forEach((b) => b.remove());
        },
        /**
         * PAL 매뉴얼 캡처: toPng + 고정 width/height는 빈 이미지가 나오는 사례가 있어 toCanvas 우선.
         * 미리보기 열(.bpmn-pdf-preview-scroll) 안에 두어 레이아웃·폰트 맥락을 맞춤.
         */
        async capturePalBlockToCanvas(el) {
            if (!el) return null;
            if (document.fonts && document.fonts.ready) {
                try {
                    await document.fonts.ready;
                } catch {
                    /* ignore */
                }
            }
            await this.$nextTick();
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            return toCanvas(el, {
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                cacheBust: true
            });
        },
        previewSVG() {
            let self = this;
            this.bpmnViewer
                .saveSVG()
                .then(({ svg }) => {
                    const previewsContainer = document.getElementById('svgPreviews');
                    if (!previewsContainer) return;
                    previewsContainer.innerHTML = ''; // 기존 내용 초기화
                    const palContainer = document.getElementById('palManualPreviews');
                    if (palContainer) palContainer.innerHTML = '';

                    const parser = new DOMParser();
                    const svgDoc = parser.parseFromString(svg, 'image/svg+xml');
                    const originalSvg = svgDoc.documentElement;

                    const vbParts = (originalSvg.getAttribute('viewBox') || '0 0 800 600').trim().split(/[\s,]+/);
                    let svgX = parseFloat(vbParts[0]) || 0;
                    let svgY = parseFloat(vbParts[1]) || 0;
                    let svgWidth = parseFloat(vbParts[2]) || 800;
                    let svgHeight = parseFloat(vbParts[3]) || 600;
                    if (svgWidth <= 0) svgWidth = 800;
                    if (svgHeight <= 0) svgHeight = 600;

                    const tight = tightenSvgExportViewBox(originalSvg, svgX, svgY, svgWidth, svgHeight);
                    svgX = tight.x;
                    svgY = tight.y;
                    svgWidth = tight.width;
                    svgHeight = tight.height;

                    // PDF 가로/세로 (landscape 등) — Pool 가로 여부만 참고
                    this.isHorizontal = true;
                    try {
                        const elementRegistry = this.bpmnViewer.get('elementRegistry');
                        const participants = elementRegistry.filter((el) => el.type === 'bpmn:Participant');
                        if (participants && participants.length > 0) {
                            this.isHorizontal = !!participants[0].di.isHorizontal;
                        }
                    } catch (e) {
                        console.warn('다이어그램 방향 확인 중 오류, 기본값(horizontal) 사용:', e);
                    }

                    // 전체 다이어그램 가로를 항상 포함하고, 세로만 필요 시 여러 페이지로 분할 (colPx 너비 기준 잘림 방지)
                    const colPx = BPMN_PDF_COLUMN_PX;
                    const fullDisplayH = (colPx * svgHeight) / svgWidth;
                    let sliceHeightSvg;
                    if (fullDisplayH <= BPMN_MAX_PAGE_DISPLAY_HEIGHT_PX) {
                        sliceHeightSvg = svgHeight;
                    } else {
                        sliceHeightSvg = (BPMN_MAX_PAGE_DISPLAY_HEIGHT_PX * svgWidth) / colPx;
                    }

                    const pages = [];
                    for (let y0 = svgY; y0 < svgY + svgHeight - 1e-6; ) {
                        const remaining = svgY + svgHeight - y0;
                        const h = Math.min(sliceHeightSvg, remaining);
                        if (h <= 0) break;
                        pages.push({ x: svgX, y: y0, w: svgWidth, h });
                        y0 += h;
                    }
                    if (pages.length === 0) {
                        pages.push({ x: svgX, y: svgY, w: svgWidth, h: svgHeight });
                    }

                    pages.forEach(({ x, y, w, h }, index) => {
                        let newSvg = originalSvg.cloneNode(true);
                        const displayHeightPx = (colPx * h) / w;
                        newSvg.setAttribute('width', colPx + 'px');
                        newSvg.setAttribute('height', displayHeightPx + 'px');
                        newSvg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
                        newSvg.style.border = 'none';
                        newSvg.style.background = 'white';
                        newSvg.style.display = 'block';
                        newSvg.style.maxWidth = '100%';
                        newSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

                        console.log(
                            `🔹 BPMN Page ${index + 1} - viewBox ${x} ${y} ${w} ${h}, display ${colPx}x${displayHeightPx.toFixed(0)}`
                        );

                        const pageNum = index + 1;
                        const pageLabelEsc = self.escapeHtml(self.$t('PDFPreviewer.pageLabel'));

                        const pageDiv = document.createElement('div');
                        pageDiv.className = 'bpmn-pdf-preview-page';
                        pageDiv.style.margin = '0';
                        pageDiv.style.display = 'block';
                        pageDiv.style.width = '100%';
                        pageDiv.style.maxWidth = `${BPMN_PDF_COLUMN_PX}px`;
                        pageDiv.style.boxSizing = 'border-box';

                        // PAL 매뉴얼 카드(buildPalTaskManualBlockHtml)와 동일한 외곽·페이지 헤더 스타일
                        pageDiv.innerHTML = `
                            <div class="pdf-previewer-pal-manual pdf-previewer-bpmn-page" style="width:100%;max-width:${BPMN_PDF_COLUMN_PX}px;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#fff;font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif;">
                                <div style="font-size:11px;color:#64748b;padding:5px 10px 4px;background:#fafafa;border-bottom:1px solid #f1f5f9;">${pageLabelEsc} ${pageNum}</div>
                                <div data-bpmn-svg-wrap="1" style="padding:4px 6px 6px;line-height:0;"></div>
                            </div>`;
                        const bodyWrap = pageDiv.querySelector('[data-bpmn-svg-wrap="1"]');
                        if (bodyWrap) bodyWrap.appendChild(newSvg);
                        previewsContainer.appendChild(pageDiv);
                    });

                    const palEntries = self.includePalManuals ? self.resolvePalManualEntries() : [];
                    if (self.includePalManuals && palEntries.length) {
                        self.$nextTick(() => {
                            const palManualEl = document.getElementById('palManualPreviews');
                            self.appendPalManualPreviewPages(palManualEl, pages.length, palEntries);
                        });
                    }
                })
                .catch((error) => {
                    console.error('SVG 내보내기 중 오류 발생:', error);
                });
        },
        /**
         * PAL 매뉴얼 미리보기 DOM만 채움(실제 PDF 페이지는 appendPalManualPages와 동일 데이터).
         */
        appendPalManualPreviewPages(palContainer, bpmnPageCount, entries) {
            if (!palContainer) return;
            if (!entries || !entries.length) return;
            let pageNum = bpmnPageCount + 1;
            for (let idx = 0; idx < entries.length; idx++) {
                const act = entries[idx];
                if (this.shouldSkipPalEntry(act)) continue;

                const chunks = this.splitPalDescriptionHtmlIntoChunks(act.description);
                for (let j = 0; j < chunks.length; j++) {
                    const isLast = j === chunks.length - 1;
                    const pageDiv = document.createElement('div');
                    pageDiv.style.margin = '0';
                    pageDiv.style.display = 'block';
                    pageDiv.style.width = '100%';
                    pageDiv.style.maxWidth = `${BPMN_PDF_COLUMN_PX}px`;
                    pageDiv.style.boxSizing = 'border-box';
                    pageDiv.setAttribute('data-pal-manual-preview', '1');
                    pageDiv.innerHTML = this.buildPalTaskManualBlockHtml(pageNum, act, {
                        descriptionOverride: chunks[j],
                        continuation: j > 0,
                        showCheckpoints: isLast,
                        showLink: isLast
                    });
                    this.applyPdfPreviewerLikeDomCleanup(pageDiv);
                    palContainer.appendChild(pageDiv);
                    pageNum++;
                }
            }
        },
        async savePDF() {
            this.loading = true;
            const name = this.bpmnViewer._definitions.name;
            const previewsContainer = document.getElementById('svgPreviews');
            if (!previewsContainer) {
                console.error('SVG 미리보기 컨테이너를 찾을 수 없습니다.');
                this.loading = false;
                return;
            }

            // 🔹 다이어그램 방향에 따라 PDF 방향 결정 (가로: landscape, 세로: portrait)
            const orientation = this.isHorizontal ? 'l' : 'p';
            const pdf = new jsPDF(orientation, 'mm', 'a4');

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            const availableWidth = pageWidth - margin * 2;
            const availableHeight = pageHeight - margin * 2;

            let pages = previewsContainer.children;
            let firstPage = true;

            for (let i = 0; i < pages.length; i++) {
                let pageDiv = pages[i];

                const canvasBpmn = await toCanvas(pageDiv, {
                    pixelRatio: 2,
                    cacheBust: true,
                    backgroundColor: '#ffffff'
                });
                const imgData = canvasBpmn.toDataURL('image/png');

                const elemWidth = canvasBpmn.width || pageDiv.clientWidth || 1;
                const elemHeight = canvasBpmn.height || pageDiv.clientHeight || 1;
                const imgAspect = elemWidth / elemHeight;
                const pageAspect = availableWidth / availableHeight;

                let renderWidth, renderHeight;

                // 🔹 어느 쪽이든 "큰쪽"을 기준으로 꽉 차게
                if (imgAspect > pageAspect) {
                    renderWidth = availableWidth;
                    renderHeight = availableWidth / imgAspect;
                } else {
                    renderHeight = availableHeight;
                    renderWidth = availableHeight * imgAspect;
                }

                // 가로는 가운데, 세로는 상단(여백) 정렬
                const x = (pageWidth - renderWidth) / 2;
                const y = margin;

                if (!firstPage) {
                    pdf.addPage();
                } else {
                    firstPage = false;
                }
                pdf.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight);
                this.progress = Math.round(((i + 1) / pages.length) * 100);
            }

            const palEntriesForPdf = this.includePalManuals ? this.resolvePalManualEntries() : [];
            const bpmnPageCount = previewsContainer.children.length;
            if (this.includePalManuals && palEntriesForPdf.length) {
                this.progress = Math.min(99, this.progress || 0);
                await this.appendPalManualPages(pdf, palEntriesForPdf, bpmnPageCount);
            }

            pdf.save(`${name}.pdf`);
            this.loading = false;
            this.progress = 0;
        },
        escapeHtml(text) {
            if (text == null || text === '') return '';
            const d = document.createElement('div');
            d.textContent = String(text);
            return d.innerHTML;
        },
        async appendPalManualPages(pdf, entries, bpmnPageCount) {
            if (!entries || !entries.length) return;
            const bpmnN = typeof bpmnPageCount === 'number' ? bpmnPageCount : 0;
            let totalChunks = 0;
            for (let i = 0; i < entries.length; i++) {
                const a = entries[i];
                if (this.shouldSkipPalEntry(a)) continue;
                totalChunks += this.splitPalDescriptionHtmlIntoChunks(a.description).length;
            }
            let done = 0;
            let pageNum = bpmnN + 1;
            for (let idx = 0; idx < entries.length; idx++) {
                const act = entries[idx];
                if (this.shouldSkipPalEntry(act)) continue;

                const chunks = this.splitPalDescriptionHtmlIntoChunks(act.description);
                for (let j = 0; j < chunks.length; j++) {
                    const isLast = j === chunks.length - 1;
                    const wrap = document.createElement('div');
                    wrap.style.cssText = [
                        'width:' + BPMN_PDF_COLUMN_PX + 'px',
                        'max-width:' + BPMN_PDF_COLUMN_PX + 'px',
                        'padding:8px',
                        'box-sizing:border-box',
                        'background:#fff',
                        'overflow:visible'
                    ].join(';');
                    wrap.innerHTML = this.buildPalTaskManualBlockHtml(pageNum, act, {
                        descriptionOverride: chunks[j],
                        continuation: j > 0,
                        showCheckpoints: isLast,
                        showLink: isLast
                    });
                    this.applyPdfPreviewerLikeDomCleanup(wrap);

                    const host =
                        document.querySelector('.bpmn-pdf-preview-scroll') ||
                        document.querySelector('.v-card') ||
                        document.body;
                    let hostSetPositionByUs = false;
                    if (host !== document.body && !host.style.position) {
                        host.style.position = 'relative';
                        hostSetPositionByUs = true;
                    }
                    wrap.style.position = 'absolute';
                    wrap.style.left = '0';
                    wrap.style.top = '0';
                    wrap.style.zIndex = '100';
                    wrap.style.pointerEvents = 'none';
                    host.appendChild(wrap);
                    try {
                        const palCanvas = await this.capturePalBlockToCanvas(wrap);
                        if (!palCanvas) {
                            pageNum++;
                            done++;
                            continue;
                        }
                        const imgData = palCanvas.toDataURL('image/png');
                        pdf.addPage('a4', 'p');
                        const pageWidth = pdf.internal.pageSize.getWidth();
                        const pageHeight = pdf.internal.pageSize.getHeight();
                        const margin = 10;
                        const availableWidth = pageWidth - margin * 2;
                        const availableHeight = pageHeight - margin * 2;
                        const elemWidth = palCanvas.width || 1;
                        const elemHeight = palCanvas.height || 1;
                        const imgAspect = elemWidth / elemHeight;
                        const pageAspect = availableWidth / availableHeight;
                        let renderWidth;
                        let renderHeight;
                        if (imgAspect > pageAspect) {
                            renderWidth = availableWidth;
                            renderHeight = availableWidth / imgAspect;
                        } else {
                            renderHeight = availableHeight;
                            renderWidth = availableHeight * imgAspect;
                        }
                        const px = (pageWidth - renderWidth) / 2;
                        const py = margin;
                        pdf.addImage(imgData, 'PNG', px, py, renderWidth, renderHeight);
                    } finally {
                        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
                        if (hostSetPositionByUs) host.style.position = '';
                    }
                    pageNum++;
                    done++;
                    this.progress = Math.min(99, Math.round((done / Math.max(totalChunks, 1)) * 100));
                }
            }
        }
    }
};
</script>

<style scoped>
/* Add your styles here */
</style>
<style>
/* BPMN 미리보기 카드: SVG 아래 생기는 인라인 여백 제거 */
.bpmn-pdf-preview-page svg {
    display: block;
    vertical-align: top;
}
/* PAL 매뉴얼 HTML: 속성 패널 PDF(Quill 본문)과 유사하게 보이도록 */
.pdf-previewer-pal-manual .ql-editor img {
    max-width: 100%;
    height: auto;
}
.pdf-previewer-pal-manual .ql-editor ul,
.pdf-previewer-pal-manual .ql-editor ol {
    padding-left: 1.25em;
    margin: 0.25em 0;
}
.pdf-previewer-pal-manual .ql-editor a {
    color: rgb(99, 102, 241);
}
</style>

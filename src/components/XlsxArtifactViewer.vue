<template>
    <div class="xlsx-viewer">
        <div class="xlsx-viewer__header">
            <div class="xlsx-viewer__heading">
                <v-icon size="18" color="success">mdi-file-excel-outline</v-icon>
                <div class="xlsx-viewer__title" :title="fileName">{{ fileName || 'Excel 통합 문서' }}</div>
                <span v-if="workbook" class="xlsx-viewer__meta">{{ sheets.length }}개 시트</span>
            </div>
            <div class="xlsx-viewer__actions">
                <v-btn icon variant="text" density="comfortable" size="small" :disabled="zoom <= 60" @click="changeZoom(-10)">
                    <v-icon size="17">mdi-magnify-minus-outline</v-icon>
                </v-btn>
                <button class="xlsx-viewer__zoom" type="button" @click="zoom = 100">{{ zoom }}%</button>
                <v-btn icon variant="text" density="comfortable" size="small" :disabled="zoom >= 180" @click="changeZoom(10)">
                    <v-icon size="17">mdi-magnify-plus-outline</v-icon>
                </v-btn>
                <v-btn icon variant="text" density="comfortable" size="small" :disabled="isLoading" @click="loadWorkbook">
                    <v-icon size="17">mdi-refresh</v-icon>
                    <v-tooltip activator="parent" location="bottom">다시 불러오기</v-tooltip>
                </v-btn>
                <v-btn icon variant="text" density="comfortable" size="small" :disabled="!fileUrl" @click="downloadFile">
                    <v-icon size="17">mdi-download</v-icon>
                    <v-tooltip activator="parent" location="bottom">원본 다운로드</v-tooltip>
                </v-btn>
                <v-btn icon variant="text" density="comfortable" size="small" @click="$emit('close')">
                    <v-icon size="18">mdi-close</v-icon>
                </v-btn>
            </div>
        </div>

        <div v-if="workbook && activeSheet" class="xlsx-viewer__formula-bar">
            <div class="xlsx-viewer__name-box">{{ selectedCell?.address || 'A1' }}</div>
            <div class="xlsx-viewer__fx">fx</div>
            <div class="xlsx-viewer__formula" :title="selectedCellFormula">{{ selectedCellFormula }}</div>
        </div>

        <div class="xlsx-viewer__body">
            <div v-if="isLoading" class="xlsx-viewer__state">
                <v-progress-circular indeterminate color="primary" :size="24" />
                <span>통합 문서를 불러오는 중...</span>
            </div>
            <div v-else-if="errorMessage" class="xlsx-viewer__state xlsx-viewer__state--error">
                <v-icon size="22" color="error">mdi-alert-circle-outline</v-icon>
                <strong>엑셀 파일을 열 수 없습니다.</strong>
                <span>{{ errorMessage }}</span>
                <v-btn size="small" variant="tonal" color="primary" @click="loadWorkbook">다시 시도</v-btn>
            </div>
            <div v-else-if="activeSheet" class="xlsx-viewer__sheet-scroll">
                <div class="xlsx-viewer__canvas" :style="canvasStyle">
                    <table class="xlsx-viewer__grid" cellspacing="0" cellpadding="0">
                        <colgroup>
                            <col :style="{ width: scaledRowHeaderWidth + 'px' }" />
                            <col v-for="column in activeSheet.columns" :key="column.index" :style="{ width: scaled(column.width) + 'px' }" />
                        </colgroup>
                        <thead>
                            <tr :style="{ height: scaled(28) + 'px' }">
                                <th class="xlsx-viewer__corner"></th>
                                <th v-for="column in activeSheet.columns" :key="column.index" class="xlsx-viewer__column-header">
                                    {{ column.letter }}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="row in activeSheet.rows" :key="row.index" :style="{ height: scaled(row.height) + 'px' }">
                                <th class="xlsx-viewer__row-header">{{ row.index }}</th>
                                <template v-for="cell in row.cells" :key="cell.address">
                                    <td
                                        v-if="!cell.skip"
                                        :rowspan="cell.rowSpan"
                                        :colspan="cell.colSpan"
                                        :class="cellClasses(cell)"
                                        :style="scaledCellStyle(cell)"
                                        :title="cell.formula ? `${cell.address}: ${cell.formula}` : `${cell.address}: ${cell.text}`"
                                        @click="selectCell(cell)"
                                    >
                                        <span class="xlsx-viewer__cell-text">{{ cell.text }}</span>
                                    </td>
                                </template>
                            </tr>
                        </tbody>
                    </table>
                    <div v-if="activeSheet.truncated" class="xlsx-viewer__limit-notice">
                        미리보기 성능을 위해 {{ activeSheet.renderedRows }}행 × {{ activeSheet.renderedColumns }}열까지만 표시합니다.
                        원본 파일에는 전체 데이터가 보존되어 있습니다.
                    </div>
                </div>
            </div>
            <div v-else class="xlsx-viewer__state">표시할 시트가 없습니다.</div>
        </div>

        <div v-if="workbook && sheets.length" class="xlsx-viewer__sheet-bar">
            <div class="xlsx-viewer__sheet-nav">
                <v-icon size="15">mdi-menu-left</v-icon>
            </div>
            <div class="xlsx-viewer__sheet-tabs">
                <button
                    v-for="(sheet, index) in sheets"
                    :key="sheet.id"
                    type="button"
                    class="xlsx-viewer__sheet-tab"
                    :class="{ 'is-active': index === activeSheetIndex }"
                    @click="activateSheet(index)"
                >
                    {{ sheet.name }}
                </button>
            </div>
            <div class="xlsx-viewer__status">{{ activeSheet?.rows.length || 0 }}행 × {{ activeSheet?.columns.length || 0 }}열</div>
        </div>
    </div>
</template>

<script>
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { getColumnLetter } from '@/utils/xlsxViewer';

const MAX_PREVIEW_ROWS = 1000;
const MAX_PREVIEW_COLUMNS = 120;
const DEFAULT_COLUMN_WIDTH = 80;
const DEFAULT_ROW_HEIGHT = 24;

export default {
    name: 'XlsxArtifactViewer',
    props: {
        fileUrl: { type: String, required: true },
        fileName: { type: String, default: '' }
    },
    emits: ['close'],
    data() {
        return {
            workbook: null,
            sheets: [],
            activeSheetIndex: 0,
            selectedCell: null,
            isLoading: false,
            errorMessage: '',
            zoom: 100,
            loadSequence: 0
        };
    },
    computed: {
        activeSheet() {
            return this.sheets[this.activeSheetIndex] || null;
        },
        selectedCellFormula() {
            if (!this.selectedCell) return '';
            return this.selectedCell.formula || this.selectedCell.text || '';
        },
        canvasStyle() {
            return {
                '--xlsx-font-size': `${this.scaled(12)}px`,
                '--xlsx-row-header-width': `${this.scaledRowHeaderWidth}px`
            };
        },
        scaledRowHeaderWidth() {
            return this.scaled(46);
        }
    },
    watch: {
        fileUrl: {
            immediate: true,
            handler() {
                this.loadWorkbook();
            }
        }
    },
    methods: {
        async loadWorkbook() {
            const sequence = ++this.loadSequence;
            this.isLoading = true;
            this.errorMessage = '';
            this.workbook = null;
            this.sheets = [];
            this.selectedCell = null;
            try {
                if (!this.fileUrl) throw new Error('파일 주소가 없습니다.');
                const response = await fetch(this.fileUrl);
                if (!response.ok) throw new Error(`파일 다운로드 실패 (HTTP ${response.status})`);
                const buffer = await response.arrayBuffer();
                const workbook = await this.readWorkbook(buffer);
                if (sequence !== this.loadSequence) return;
                this.workbook = workbook;
                this.sheets = workbook.worksheets.map((worksheet) => this.buildSheetModel(worksheet));
                this.activeSheetIndex = 0;
                this.selectFirstCell();
            } catch (error) {
                if (sequence !== this.loadSequence) return;
                console.error('[XlsxArtifactViewer] workbook load failed:', error);
                const message = error?.message || '알 수 없는 오류가 발생했습니다.';
                this.errorMessage = message.includes('Failed to fetch')
                    ? '파일 서버에서 원본을 가져오지 못했습니다. 파일 URL 또는 CORS 설정을 확인해주세요.'
                    : message;
            } finally {
                if (sequence === this.loadSequence) this.isLoading = false;
            }
        },
        async readWorkbook(buffer) {
            const workbook = new ExcelJS.Workbook();
            try {
                await workbook.xlsx.load(buffer.slice(0));
                return workbook;
            } catch (initialError) {
                // 일부 OOXML 생성기는 기본 namespace 대신 모든 요소에 `x:` 접두사를 붙인다.
                // Excel/SheetJS는 허용하지만 ExcelJS 4.x는 workbook.xml을 인식하지 못하므로,
                // 원본 파일은 건드리지 않고 메모리 복사본의 요소 접두사만 정규화한다.
                const normalized = await this.normalizeOoxmlNamespaces(buffer);
                if (!normalized) throw initialError;
                const compatibleWorkbook = new ExcelJS.Workbook();
                await compatibleWorkbook.xlsx.load(normalized);
                return compatibleWorkbook;
            }
        },
        async normalizeOoxmlNamespaces(buffer) {
            const zip = await JSZip.loadAsync(buffer.slice(0));
            let changed = false;
            for (const [name, entry] of Object.entries(zip.files)) {
                if (entry.dir || !name.toLowerCase().endsWith('.xml')) continue;
                const xml = await entry.async('string');
                if (!xml.includes('<x:') && !xml.includes('</x:')) continue;
                zip.file(name, xml.replaceAll('<x:', '<').replaceAll('</x:', '</').replaceAll('xmlns:x=', 'xmlns='));
                changed = true;
            }
            if (!changed) return null;
            return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
        },
        buildSheetModel(worksheet) {
            const merges = this.readMerges(worksheet);
            let maxRow = Math.max(worksheet.actualRowCount || 0, worksheet.rowCount || 0, 1);
            let maxColumn = Math.max(worksheet.actualColumnCount || 0, worksheet.columnCount || 0, 1);
            for (const merge of merges) {
                maxRow = Math.max(maxRow, merge.bottom);
                maxColumn = Math.max(maxColumn, merge.right);
            }
            const sourceRows = maxRow;
            const sourceColumns = maxColumn;
            maxRow = Math.min(maxRow, MAX_PREVIEW_ROWS);
            maxColumn = Math.min(maxColumn, MAX_PREVIEW_COLUMNS);

            const mergeAnchors = new Map();
            const mergedChildren = new Set();
            for (const merge of merges) {
                if (merge.top > maxRow || merge.left > maxColumn) continue;
                const bottom = Math.min(merge.bottom, maxRow);
                const right = Math.min(merge.right, maxColumn);
                mergeAnchors.set(`${merge.top}:${merge.left}`, {
                    rowSpan: bottom - merge.top + 1,
                    colSpan: right - merge.left + 1
                });
                for (let row = merge.top; row <= bottom; row += 1) {
                    for (let column = merge.left; column <= right; column += 1) {
                        if (row !== merge.top || column !== merge.left) mergedChildren.add(`${row}:${column}`);
                    }
                }
            }

            const columns = [];
            for (let column = 1; column <= maxColumn; column += 1) {
                const source = worksheet.getColumn(column);
                const width = source.hidden ? 0 : this.columnWidthPixels(source.width);
                columns.push({ index: column, letter: getColumnLetter(column), width: Math.max(width, 2) });
            }

            const rows = [];
            for (let row = 1; row <= maxRow; row += 1) {
                const sourceRow = worksheet.getRow(row);
                const cells = [];
                for (let column = 1; column <= maxColumn; column += 1) {
                    const sourceCell = worksheet.getCell(row, column);
                    const merge = mergeAnchors.get(`${row}:${column}`);
                    const formula = this.cellFormula(sourceCell);
                    cells.push({
                        address: sourceCell.address,
                        row,
                        column,
                        text: this.cellText(sourceCell),
                        formula,
                        style: this.cellStyle(sourceCell),
                        rowSpan: merge?.rowSpan || 1,
                        colSpan: merge?.colSpan || 1,
                        skip: mergedChildren.has(`${row}:${column}`),
                        isFormula: !!formula
                    });
                }
                rows.push({
                    index: row,
                    height: sourceRow.hidden ? 0 : this.rowHeightPixels(sourceRow.height),
                    cells
                });
            }
            return {
                id: worksheet.id,
                name: worksheet.name,
                state: worksheet.state,
                columns,
                rows,
                renderedRows: maxRow,
                renderedColumns: maxColumn,
                truncated: sourceRows > maxRow || sourceColumns > maxColumn
            };
        },
        readMerges(worksheet) {
            const ranges = worksheet?.model?.merges || [];
            return ranges.map((range) => this.parseRange(range)).filter(Boolean);
        },
        parseRange(range) {
            const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(range || '');
            if (!match) return null;
            return {
                top: Number(match[2]),
                left: this.columnNumber(match[1]),
                bottom: Number(match[4]),
                right: this.columnNumber(match[3])
            };
        },
        columnNumber(letters) {
            return letters.toUpperCase().split('').reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
        },
        cellText(cell) {
            if (cell.value == null) return '';
            if (cell.value instanceof Date) return cell.text || cell.value.toLocaleDateString('ko-KR');
            if (typeof cell.value === 'object') {
                if (cell.value.formula || cell.value.sharedFormula) {
                    const result = cell.value.result;
                    return result == null ? '' : String(result);
                }
                if (Array.isArray(cell.value.richText)) return cell.value.richText.map((item) => item.text || '').join('');
                if (cell.value.text != null) return String(cell.value.text);
                if (cell.value.error != null) return String(cell.value.error);
            }
            return cell.text != null ? String(cell.text) : String(cell.value);
        },
        cellFormula(cell) {
            const value = cell.value;
            if (!value || typeof value !== 'object') return '';
            const formula = value.formula || value.sharedFormula;
            return formula ? `=${formula}` : '';
        },
        cellStyle(cell) {
            const font = cell.font || {};
            const alignment = cell.alignment || {};
            const fill = cell.fill || {};
            const style = {
                color: this.colorValue(font.color),
                backgroundColor: fill.type === 'pattern' && fill.pattern !== 'none' ? this.colorValue(fill.fgColor || fill.bgColor) : '',
                fontFamily: font.name ? `'${font.name}', 'Malgun Gothic', sans-serif` : '',
                fontSize: font.size ? `${font.size}px` : '',
                fontWeight: font.bold ? '700' : '',
                fontStyle: font.italic ? 'italic' : '',
                textDecoration: [font.underline ? 'underline' : '', font.strike ? 'line-through' : ''].filter(Boolean).join(' '),
                textAlign: this.horizontalAlignment(alignment.horizontal),
                verticalAlign: this.verticalAlignment(alignment.vertical),
                whiteSpace: alignment.wrapText ? 'pre-wrap' : 'pre',
                transform: alignment.textRotation ? `rotate(${Math.max(-90, Math.min(90, Number(alignment.textRotation) || 0))}deg)` : '',
                borderTop: this.borderValue(cell.border?.top),
                borderRight: this.borderValue(cell.border?.right),
                borderBottom: this.borderValue(cell.border?.bottom),
                borderLeft: this.borderValue(cell.border?.left)
            };
            return Object.fromEntries(Object.entries(style).filter(([, value]) => value !== ''));
        },
        colorValue(color) {
            const argb = color?.argb;
            if (typeof argb === 'string' && argb.length >= 6) return `#${argb.slice(-6)}`;
            const indexed = Number(color?.indexed);
            const indexedColors = { 0: '#000000', 1: '#FFFFFF', 2: '#FF0000', 3: '#00FF00', 4: '#0000FF', 5: '#FFFF00', 6: '#FF00FF', 7: '#00FFFF' };
            return indexedColors[indexed] || '';
        },
        borderValue(border) {
            if (!border?.style) return '';
            const width = ['medium', 'mediumDashed', 'mediumDashDot', 'mediumDashDotDot'].includes(border.style)
                ? 2
                : ['thick', 'double'].includes(border.style) ? 3 : 1;
            const line = border.style.includes('dash') || border.style.includes('Dash') ? 'dashed' : border.style === 'dotted' ? 'dotted' : 'solid';
            return `${width}px ${line} ${this.colorValue(border.color) || '#8f969d'}`;
        },
        horizontalAlignment(value) {
            if (value === 'center' || value === 'centerContinuous') return 'center';
            if (value === 'right') return 'right';
            if (value === 'justify' || value === 'distributed') return 'justify';
            return value === 'left' ? 'left' : '';
        },
        verticalAlignment(value) {
            if (value === 'top' || value === 'bottom' || value === 'middle') return value;
            return value === 'center' ? 'middle' : '';
        },
        columnWidthPixels(width) {
            if (!Number.isFinite(Number(width))) return DEFAULT_COLUMN_WIDTH;
            return Math.max(24, Math.round(Number(width) * 7 + 7));
        },
        rowHeightPixels(height) {
            if (!Number.isFinite(Number(height))) return DEFAULT_ROW_HEIGHT;
            return Math.max(4, Math.round(Number(height) * 96 / 72));
        },
        scaled(value) {
            return Math.round(Number(value || 0) * this.zoom / 100);
        },
        scaledCellStyle(cell) {
            const style = { ...cell.style };
            if (style.fontSize) style.fontSize = `${this.scaled(parseFloat(style.fontSize))}px`;
            return style;
        },
        cellClasses(cell) {
            return {
                'xlsx-viewer__cell': true,
                'is-selected': this.selectedCell?.address === cell.address,
                'is-formula': cell.isFormula
            };
        },
        selectCell(cell) {
            this.selectedCell = cell;
        },
        selectFirstCell() {
            this.selectedCell = this.activeSheet?.rows?.[0]?.cells?.find((cell) => !cell.skip) || null;
        },
        activateSheet(index) {
            this.activeSheetIndex = index;
            this.selectFirstCell();
        },
        changeZoom(delta) {
            this.zoom = Math.max(60, Math.min(180, this.zoom + delta));
        },
        downloadFile() {
            if (!this.fileUrl) return;
            const anchor = document.createElement('a');
            anchor.href = this.fileUrl;
            anchor.download = this.fileName || 'workbook.xlsx';
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
        }
    },
    beforeUnmount() {
        this.loadSequence += 1;
    }
};
</script>

<style scoped>
.xlsx-viewer { display:flex; flex-direction:column; height:100%; min-height:0; background:#fff; color:#202124; }
.xlsx-viewer__header { display:flex; align-items:center; justify-content:space-between; min-height:48px; padding:0 8px 0 14px; border-bottom:1px solid #d9dde3; background:#fff; }
.xlsx-viewer__heading,.xlsx-viewer__actions { display:flex; align-items:center; min-width:0; }
.xlsx-viewer__heading { gap:8px; }
.xlsx-viewer__title { max-width:360px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; font-weight:600; }
.xlsx-viewer__meta { color:#78828e; font-size:11px; white-space:nowrap; }
.xlsx-viewer__zoom { min-width:42px; border:0; background:transparent; color:#5f6770; font-size:11px; cursor:pointer; }
.xlsx-viewer__formula-bar { display:grid; grid-template-columns:92px 34px minmax(0,1fr); align-items:center; min-height:32px; border-bottom:1px solid #d9dde3; background:#fff; font-size:12px; }
.xlsx-viewer__name-box { padding:6px 10px; border-right:1px solid #d9dde3; text-align:center; font-variant-numeric:tabular-nums; }
.xlsx-viewer__fx { color:#6c747d; font-family:Georgia,serif; font-style:italic; text-align:center; }
.xlsx-viewer__formula { min-width:0; overflow:hidden; padding:6px 8px; border-left:1px solid #eef0f2; text-overflow:ellipsis; white-space:nowrap; }
.xlsx-viewer__body { position:relative; flex:1; min-height:0; background:#f5f7f9; }
.xlsx-viewer__state { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; height:100%; color:#69737e; font-size:12px; text-align:center; }
.xlsx-viewer__state--error span { max-width:420px; }
.xlsx-viewer__sheet-scroll { position:absolute; inset:0; overflow:auto; background:#edf0f3; }
.xlsx-viewer__canvas { min-width:max-content; min-height:100%; background:#fff; }
.xlsx-viewer__grid { table-layout:fixed; border-spacing:0; border-collapse:separate; background:#fff; font-size:var(--xlsx-font-size); }
.xlsx-viewer__grid th,.xlsx-viewer__grid td { box-sizing:border-box; }
.xlsx-viewer__corner,.xlsx-viewer__column-header,.xlsx-viewer__row-header { position:sticky; z-index:4; padding:0; border-right:1px solid #c9ced4; border-bottom:1px solid #c9ced4; background:#f3f5f7; color:#606870; font-weight:400; text-align:center; user-select:none; }
.xlsx-viewer__corner { top:0; left:0; z-index:7; }
.xlsx-viewer__column-header { top:0; height:28px; }
.xlsx-viewer__row-header { left:0; width:var(--xlsx-row-header-width); min-width:var(--xlsx-row-header-width); }
.xlsx-viewer__cell { position:relative; overflow:hidden; height:inherit; min-width:2px; padding:3px 6px; border-right:1px solid #e1e4e8; border-bottom:1px solid #e1e4e8; background:#fff; color:#202124; line-height:1.3; text-overflow:clip; cursor:cell; }
.xlsx-viewer__cell:hover { outline:1px solid rgba(22,119,73,.45); outline-offset:-1px; }
.xlsx-viewer__cell.is-selected { overflow:visible; z-index:3; outline:2px solid #16834f !important; outline-offset:-2px; }
.xlsx-viewer__cell.is-selected::after { position:absolute; right:-3px; bottom:-3px; width:6px; height:6px; border:1px solid #fff; background:#16834f; content:''; }
.xlsx-viewer__cell.is-formula:not(.is-selected)::before { position:absolute; top:0; left:0; width:0; height:0; border-top:4px solid rgba(22,131,79,.35); border-right:4px solid transparent; content:''; }
.xlsx-viewer__cell-text { display:block; overflow:hidden; max-width:100%; text-overflow:clip; }
.xlsx-viewer__sheet-bar { display:flex; align-items:stretch; min-height:38px; border-top:1px solid #ccd2d8; background:#f7f8fa; }
.xlsx-viewer__sheet-nav { display:flex; align-items:center; justify-content:center; width:34px; border-right:1px solid #dde1e5; color:#65707a; }
.xlsx-viewer__sheet-tabs { display:flex; flex:1; min-width:0; overflow-x:auto; }
.xlsx-viewer__sheet-tab { position:relative; min-width:88px; max-width:200px; overflow:hidden; padding:0 16px; border:0; border-right:1px solid #e1e4e8; background:transparent; color:#525b65; font-size:12px; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; }
.xlsx-viewer__sheet-tab:hover { background:#edf4f0; }
.xlsx-viewer__sheet-tab.is-active { background:#fff; color:#146c43; font-weight:600; }
.xlsx-viewer__sheet-tab.is-active::after { position:absolute; right:8px; bottom:0; left:8px; height:3px; border-radius:2px 2px 0 0; background:#16834f; content:''; }
.xlsx-viewer__status { display:flex; align-items:center; padding:0 12px; border-left:1px solid #dde1e5; color:#747e88; font-size:10px; white-space:nowrap; }
.xlsx-viewer__limit-notice { position:sticky; left:12px; width:max-content; margin:14px; padding:8px 12px; border:1px solid #efcf75; border-radius:6px; background:#fff9df; color:#725a13; font-size:11px; }
</style>

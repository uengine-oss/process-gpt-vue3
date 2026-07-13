<template>
    <div class="csv-viewer">
        <div class="csv-viewer__toolbar">
            <span class="csv-viewer__title" :title="fileName">{{ fileName }}</span>
            <div class="csv-viewer__actions">
                <span v-if="rows.length" class="csv-viewer__count">{{ rows.length }}행</span>
                <v-btn icon size="x-small" variant="text" title="다운로드(.csv)" @click="downloadCsv">
                    <v-icon size="15">mdi-download</v-icon>
                </v-btn>
            </div>
        </div>
        <div v-if="loading" class="csv-viewer__status">불러오는 중…</div>
        <div v-else-if="error" class="csv-viewer__status">{{ error }}</div>
        <div v-else class="csv-viewer__body">
            <table class="csv-table">
                <thead>
                    <tr>
                        <th v-for="(h, i) in header" :key="i">{{ h }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(row, ri) in rows" :key="ri">
                        <td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script>
export default {
    name: 'CsvViewer',
    props: {
        fileUrl: { type: String, default: '' },
        fileName: { type: String, default: 'CSV' }
    },
    emits: ['close'],
    data() {
        return { text: '', loading: false, error: '' };
    },
    computed: {
        parsed() {
            return this.parseCsv(this.text || '');
        },
        header() {
            return this.parsed[0] || [];
        },
        rows() {
            return this.parsed.slice(1);
        }
    },
    watch: {
        fileUrl: { immediate: true, handler() { this.maybeFetch(); } }
    },
    methods: {
        async maybeFetch() {
            if (!this.fileUrl) return;
            this.loading = true;
            this.error = '';
            try {
                const resp = await fetch(this.fileUrl);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                let t = await resp.text();
                // UTF-8 BOM 제거 (엑셀 호환용으로 붙여둔 것)
                if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
                this.text = t;
            } catch (e) {
                this.error = 'CSV 를 불러오지 못했습니다.';
            } finally {
                this.loading = false;
            }
        },
        // RFC4180 최소 파서 — 따옴표/이스케이프("")/개행 포함 셀 처리
        parseCsv(text) {
            const rows = [];
            let row = [];
            let field = '';
            let inQuotes = false;
            for (let i = 0; i < text.length; i++) {
                const c = text[i];
                if (inQuotes) {
                    if (c === '"') {
                        if (text[i + 1] === '"') { field += '"'; i++; }
                        else inQuotes = false;
                    } else field += c;
                } else if (c === '"') {
                    inQuotes = true;
                } else if (c === ',') {
                    row.push(field); field = '';
                } else if (c === '\r') {
                    // swallow — \r\n 은 \n 에서 처리
                } else if (c === '\n') {
                    row.push(field); field = '';
                    rows.push(row); row = [];
                } else field += c;
            }
            if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
            // 끝에 빈 행 제거
            return rows.filter((r) => r.length > 1 || (r[0] && r[0].trim() !== ''));
        },
        downloadCsv() {
            const blob = new Blob(['﻿' + (this.text || '')], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const base = this.fileName || 'requirements';
            a.download = /\.csv$/i.test(base) ? base : `${base}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }
};
</script>

<style scoped>
.csv-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
}

.csv-viewer__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 10px;
    border-bottom: 1px solid rgba(var(--v-theme-borderColor), 0.6);
    flex-shrink: 0;
    gap: 8px;
}

.csv-viewer__title {
    font-size: 12px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(var(--v-theme-on-surface), 0.7);
}

.csv-viewer__actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
}

.csv-viewer__count {
    font-size: 11px;
    color: rgba(var(--v-theme-on-surface), 0.5);
}

.csv-viewer__body {
    flex: 1;
    overflow: auto;
    padding: 8px;
}

.csv-viewer__status {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: rgba(var(--v-theme-on-surface), 0.5);
}

.csv-table {
    border-collapse: collapse;
    width: 100%;
    font-size: 12px;
}

.csv-table th,
.csv-table td {
    border: 1px solid rgba(var(--v-theme-on-surface), 0.2);
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
}

.csv-table th {
    background: rgba(var(--v-theme-primary), 0.08);
    font-weight: 600;
    white-space: nowrap;
    position: sticky;
    top: 0;
    z-index: 1;
}

.csv-table td:first-child {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    color: rgba(var(--v-theme-on-surface), 0.7);
}
</style>

<template>
    <div class="kv-diff-table">
        <v-table density="compact" class="kv-table">
            <thead>
                <tr>
                    <th class="kv-th">필드</th>
                    <th v-if="tableMode === 'one'" class="kv-th">값</th>
                    <template v-else>
                        <th class="kv-th">전</th>
                        <th class="kv-th">후</th>
                    </template>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(row, idx) in normalizedRows" :key="idx">
                    <td class="kv-td kv-field">{{ row.label }}</td>
                    <td v-if="tableMode === 'one'" class="kv-td" :class="row.oneClass">
                        {{ formatValue(row.oneValue) }}
                    </td>
                    <template v-else>
                        <td class="kv-td" :class="row.prevClass">{{ formatValue(row.previous) }}</td>
                        <td class="kv-td" :class="row.currClass">{{ formatValue(row.current) }}</td>
                    </template>
                </tr>
            </tbody>
        </v-table>
    </div>
</template>

<script>
export default {
    name: 'KeyValueDiffTable',
    props: {
        diffs: {
            type: Array,
            default: () => []
        },
        labels: {
            type: Object,
            default: () => ({})
        }
    },
    computed: {
        tableMode() {
            const rows = (this.diffs || []).filter((d) => !((d.previous === undefined || d.previous === null) && (d.current === undefined || d.current === null)));
            if (rows.length === 0) return 'one';

            const isPrevOnly = rows.every((d) => (d.current === undefined || d.current === null) && !(d.previous === undefined || d.previous === null));
            const isCurrOnly = rows.every((d) => (d.previous === undefined || d.previous === null) && !(d.current === undefined || d.current === null));

            if (isPrevOnly || isCurrOnly) return 'one';
            return 'two';
        },
        normalizedRows() {
            return (this.diffs || []).filter((d) => !((d.previous === undefined || d.previous === null) && (d.current === undefined || d.current === null))).map((d) => {
                const prevUndef = d.previous === undefined || d.previous === null;
                const currUndef = d.current === undefined || d.current === null;

                let prevClass = '';
                let currClass = '';
                if (prevUndef && !currUndef) {
                    currClass = 'dmn-cell-added';
                } else if (!prevUndef && currUndef) {
                    prevClass = 'dmn-cell-removed';
                } else {
                    prevClass = 'dmn-cell-modified';
                    currClass = 'dmn-cell-modified';
                }

                const oneValue = !currUndef ? d.current : d.previous;
                let oneClass = '';
                if (prevUndef && !currUndef) oneClass = 'dmn-cell-added';
                else if (!prevUndef && currUndef) oneClass = 'dmn-cell-removed';
                else oneClass = 'dmn-cell-modified';

                return {
                    label: this.labels[d.field] || d.field,
                    previous: d.previous,
                    current: d.current,
                    prevClass,
                    currClass,
                    oneValue,
                    oneClass
                };
            });
        }
    },
    methods: {
        formatValue(value) {
            if (value === undefined || value === null) return '-';
            if (typeof value === 'string') return value || '-';
            try {
                return JSON.stringify(value, null, 2);
            } catch (e) {
                return String(value);
            }
        }
    }
};
</script>

<style scoped>
.kv-diff-table {
    background-color: rgba(var(--v-theme-surface), 1);
    border-radius: 4px;
    padding: 8px;
    border: 1px solid rgba(var(--v-border-color), 0.12);
    overflow: auto;
}

.kv-table {
    width: 100%;
}

.kv-th {
    font-size: 12px;
    font-weight: 600;
    padding: 8px 12px;
    border: 1px solid rgba(var(--v-border-color), 0.12);
    background-color: rgba(var(--v-theme-surface-variant), 0.3);
}

.kv-td {
    font-size: 12px;
    padding: 8px 12px;
    border: 1px solid rgba(var(--v-border-color), 0.12);
    white-space: pre-wrap;
    word-break: break-word;
    vertical-align: top;
}

.kv-field {
    width: 140px;
    white-space: nowrap;
}

.dmn-cell-added {
    background-color: rgba(76, 175, 80, 0.18) !important;
    font-weight: 600;
}

.dmn-cell-modified {
    background-color: rgba(255, 152, 0, 0.18) !important;
    font-weight: 600;
}

.dmn-cell-removed {
    background-color: rgba(244, 67, 54, 0.12) !important;
    text-decoration: line-through;
    opacity: 0.8;
}
</style>



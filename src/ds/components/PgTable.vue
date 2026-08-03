<template>
    <div class="pg-table-wrap">
        <table class="pg-table">
            <thead>
                <tr>
                    <th
                        v-for="col in columns"
                        :key="col.key"
                        :style="{ width: col.width, textAlign: col.align || 'left' }"
                        :aria-sort="sortBy === col.key ? (sortDesc ? 'descending' : 'ascending') : undefined"
                    >
                        <button v-if="col.sortable" class="pg-table__sort" type="button" @click="toggleSort(col.key)">
                            {{ col.label }}
                            <PgIcon
                                v-if="sortBy === col.key"
                                :name="sortDesc ? 'mdi-arrow-down' : 'mdi-arrow-up'"
                                :size="12"
                            />
                        </button>
                        <template v-else>{{ col.label }}</template>
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr v-if="loading">
                    <td :colspan="columns.length" class="pg-table__state">
                        <PgSpinner :size="18" />
                    </td>
                </tr>
                <tr v-else-if="!rows.length">
                    <td :colspan="columns.length" class="pg-table__state">{{ emptyText }}</td>
                </tr>
                <tr
                    v-for="(row, i) in rows"
                    v-else
                    :key="rowKey ? String(row[rowKey]) : i"
                    :class="{ 'pg-table__row--clickable': clickable }"
                    @click="clickable && $emit('rowClick', row)"
                >
                    <td v-for="col in columns" :key="col.key" :style="{ textAlign: col.align || 'left' }">
                        <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">{{ row[col.key] }}</slot>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script setup lang="ts">
import PgIcon from './PgIcon.vue';
import PgSpinner from './PgSpinner.vue';

type Column = { key: string; label: string; width?: string; align?: 'left' | 'center' | 'right'; sortable?: boolean };

const props = withDefaults(
    defineProps<{
        columns?: Column[];
        rows?: Array<Record<string, any>>;
        rowKey?: string;
        loading?: boolean;
        clickable?: boolean;
        emptyText?: string;
        sortBy?: string;
        sortDesc?: boolean;
    }>(),
    { columns: () => [], rows: () => [], loading: false, clickable: false, emptyText: '데이터가 없습니다', sortDesc: false }
);

const emit = defineEmits<{
    (e: 'rowClick', row: Record<string, any>): void;
    (e: 'update:sortBy', v: string): void;
    (e: 'update:sortDesc', v: boolean): void;
}>();

function toggleSort(key: string) {
    if (props.sortBy === key) {
        emit('update:sortDesc', !props.sortDesc);
        return;
    }
    emit('update:sortBy', key);
    emit('update:sortDesc', false);
}
</script>

<script lang="ts">
export default { name: 'PgTable' };
</script>

<style scoped>
.pg-table-wrap {
    width: 100%;
    overflow-x: auto;
}

.pg-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--cds-font-size-body);
    line-height: var(--cds-leading-body);
}

/* 실측 스펙: th 하단 0.5px @60%, td 하단 0.5px @30%, 셀 padding 8px 16px 8px 0, 상단 정렬 */
.pg-table th,
.pg-table td {
    padding: 8px 16px 8px 0;
    vertical-align: top;
    text-align: left;
}
.pg-table th {
    border-bottom: 0.5px solid hsl(var(--border-300) / 60%);
    color: var(--cds-text-primary);
    font-weight: var(--cds-font-weight-semibold);
    white-space: nowrap;
}
.pg-table td {
    border-bottom: 0.5px solid hsl(var(--border-300) / 30%);
    color: var(--cds-text-secondary);
}

.pg-table__sort {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
}
.pg-table__sort:hover {
    color: hsl(var(--accent-brand));
}

.pg-table__row--clickable {
    cursor: pointer;
}
.pg-table__row--clickable:hover td {
    background: var(--cds-bg-neutral);
}

.pg-table__state {
    padding: 28px 0;
    text-align: center;
    color: var(--cds-text-muted);
}
</style>

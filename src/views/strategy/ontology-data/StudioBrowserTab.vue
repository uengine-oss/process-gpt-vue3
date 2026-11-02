<script setup lang="ts">
// Studio 데이터 탭 — Ontology Studio 스키마 그룹 → 클래스 → 행을 Process-GPT 안에서 둘러본다(spec 020).
// Studio 가 꺼져 있으면 빈 목록으로 숨기지 않고 오류를 그대로 보인다.
import { computed, onMounted, ref } from 'vue';
import { ontologyDataApi, apiError, studioWebUrl, type StudioClass, type StudioRows, type StudioSchema } from './ontologyDataApi';

const props = defineProps<{ initialClass?: string }>();
const emit = defineEmits<{ (e: 'use-class', cls: string): void }>();

const loading = ref(false);
const error = ref<string | null>(null);
const studioUrl = ref('');
const schemas = ref<StudioSchema[]>([]);
const openSchemas = ref<string[]>([]);
const selected = ref<{ schema: StudioSchema; cls: StudioClass } | null>(null);
const rows = ref<StudioRows | null>(null);
const rowsLoading = ref(false);
const filterKey = ref('');
const filterValue = ref('');

async function load() {
    loading.value = true;
    error.value = null;
    try {
        const res = await ontologyDataApi.studioSchemas();
        schemas.value = res.schemas || [];
        studioUrl.value = studioWebUrl(res.studio_url);
        error.value = res.error;
        // 익스플로러 Studio 데이터 열에서 넘어올 때(?cls=): 그 클래스를 바로 연다
        const s = props.initialClass && !selected.value ? schemas.value.find((x) => x.classes.some((c) => c.class_name === props.initialClass)) : null;
        if (s) {
            openSchemas.value = [s.id];
            pick(s, s.classes.find((c) => c.class_name === props.initialClass)!);
        } else if (!openSchemas.value.length && schemas.value.length) openSchemas.value = [schemas.value[0].id];
    } catch (e) {
        error.value = apiError(e);
    } finally {
        loading.value = false;
    }
}

async function pick(schema: StudioSchema, cls: StudioClass) {
    selected.value = { schema, cls };
    filterKey.value = '';
    filterValue.value = '';
    await loadRows();
}

async function loadRows() {
    if (!selected.value) return;
    rowsLoading.value = true;
    try {
        const where = filterKey.value && filterValue.value !== '' ? { [filterKey.value]: castValue(filterValue.value) } : undefined;
        rows.value = await ontologyDataApi.studioRows(selected.value.cls.class_name, where, 50);
    } catch (e) {
        rows.value = { class: selected.value.cls.class_name, total: 0, rows: [], columns: [], error: apiError(e) };
    } finally {
        rowsLoading.value = false;
    }
}

function castValue(v: string) {
    return v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : v;
}

const propDesc = computed<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const p of selected.value?.cls.properties || []) out[p.name] = p.description || '';
    return out;
});

// 열 순서: 스키마에 정의된 속성 순서 → 나머지(값이 많이 찬 순). 이름은 맨 앞
const headers = computed(() => {
    const order = (selected.value?.cls.properties || []).map((p) => p.name);
    const rank = (k: string) => (k === 'name' ? -1 : order.includes(k) ? order.indexOf(k) : 1000);
    return (rows.value?.columns || [])
        .filter((c) => !c.system)
        .sort((a, b) => rank(a.key) - rank(b.key) || b.filled - a.filled)
        .slice(0, 16)
        .map((c) => ({ title: c.key, key: c.key, sortable: false, align: c.numeric ? ('end' as const) : ('start' as const) }));
});

const classRels = computed(() => {
    if (!selected.value) return [];
    const name = selected.value.cls.class_name;
    return selected.value.schema.relationships.filter((r) => r.from_class === name || r.to_class === name);
});

function cell(v: any) {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'number' ? v.toLocaleString('ko-KR', { maximumFractionDigits: 3 }) : String(v);
    return s.length > 60 ? s.slice(0, 59) + '…' : s;
}

onMounted(load);
defineExpose({ reload: load });
</script>

<template>
    <div class="studio-browser">
        <v-alert v-if="error" type="warning" variant="tonal" density="compact" class="mb-3">
            Ontology Studio 에 접속하지 못했습니다. {{ error }}
        </v-alert>
        <div class="browser-layout">
            <v-card variant="outlined" class="schema-list">
                <div class="d-flex align-center pa-3 pb-1">
                    <span class="text-subtitle-2 font-weight-bold">스키마 그룹</span>
                    <v-spacer />
                    <v-btn icon size="x-small" variant="text" :loading="loading" @click="load" title="새로고침">
                        <v-icon size="16">mdi-refresh</v-icon>
                    </v-btn>
                </div>
                <v-list v-model:opened="openSchemas" density="compact" class="py-0">
                    <v-list-group v-for="s in schemas" :key="s.id" :value="s.id">
                        <template #activator="{ props }">
                            <v-list-item v-bind="props" :title="s.name" :subtitle="`클래스 ${s.classes.length} · ${s.total_entity_count.toLocaleString()}건`" />
                        </template>
                        <v-list-item
                            v-for="c in s.classes"
                            :key="c.class_name"
                            :active="selected?.cls.class_name === c.class_name"
                            color="primary"
                            class="class-item"
                            @click="pick(s, c)"
                        >
                            <v-list-item-title class="text-body-2">{{ c.class_name }}</v-list-item-title>
                            <v-list-item-subtitle class="text-caption">{{ c.description || '설명 없음' }}</v-list-item-subtitle>
                            <template #append>
                                <span class="text-caption text-medium-emphasis">{{ c.entity_count.toLocaleString() }}</span>
                            </template>
                        </v-list-item>
                    </v-list-group>
                </v-list>
                <div v-if="!loading && !schemas.length && !error" class="pa-4 text-caption text-medium-emphasis">
                    Studio 에 스키마가 없습니다.
                </div>
            </v-card>

            <v-card variant="outlined" class="class-detail">
                <div v-if="!selected" class="empty-detail text-medium-emphasis">
                    <v-icon size="40" class="mb-2">mdi-database-search-outline</v-icon>
                    <div>왼쪽에서 클래스를 고르면 속성과 데이터가 보입니다.</div>
                </div>
                <template v-else>
                    <div class="d-flex align-start pa-4 pb-2 ga-2 flex-wrap">
                        <div class="flex-grow-1">
                            <div class="text-caption text-medium-emphasis">{{ selected.schema.name }}</div>
                            <div class="text-h6 font-weight-bold">{{ selected.cls.class_name }}</div>
                            <div class="text-body-2 text-medium-emphasis">{{ selected.cls.description }}</div>
                        </div>
                        <v-btn size="small" variant="outlined" color="primary" @click="emit('use-class', selected.cls.class_name)">
                            <v-icon start size="16">mdi-table-plus</v-icon>이 클래스로 데이터셋 만들기
                        </v-btn>
                        <v-btn v-if="studioUrl" size="small" variant="text" :href="studioUrl" target="_blank">
                            <v-icon start size="16">mdi-open-in-new</v-icon>Studio 에서 열기
                        </v-btn>
                    </div>
                    <div v-if="classRels.length" class="px-4 pb-2 d-flex flex-wrap ga-1">
                        <v-chip v-for="r in classRels" :key="r.name + r.from_class + r.to_class" size="x-small" variant="tonal">
                            {{ r.from_class }} —{{ r.description || r.name }}→ {{ r.to_class }}
                        </v-chip>
                    </div>
                    <div class="d-flex align-center ga-2 px-4 pb-2 flex-wrap">
                        <v-select
                            v-model="filterKey"
                            :items="(rows?.columns || []).filter((c) => !c.system).map((c) => c.key)"
                            label="필터 속성"
                            density="compact"
                            hide-details
                            clearable
                            style="max-width: 200px"
                        />
                        <v-text-field
                            v-model="filterValue"
                            label="값"
                            density="compact"
                            hide-details
                            style="max-width: 200px"
                            @keyup.enter="loadRows"
                        />
                        <v-btn size="small" variant="tonal" @click="loadRows">적용</v-btn>
                        <v-spacer />
                        <span class="text-caption text-medium-emphasis" v-if="rows && !rows.error">
                            {{ rows.total.toLocaleString() }}건 중 앞 {{ rows.rows.length }}건
                        </span>
                    </div>
                    <v-alert v-if="rows?.error" type="warning" variant="tonal" density="compact" class="mx-4 mb-2">{{ rows.error }}</v-alert>
                    <v-data-table
                        :headers="headers"
                        :items="rows?.rows || []"
                        :loading="rowsLoading"
                        density="compact"
                        :items-per-page="10"
                        class="rows-table"
                    >
                        <template v-for="h in headers" :key="h.key" #[`header.${h.key}`]>
                            <div class="col-head" :title="propDesc[h.key] || h.key">
                                <div>{{ h.key }}</div>
                                <div v-if="propDesc[h.key] && propDesc[h.key] !== '폼 값'" class="col-desc">{{ propDesc[h.key] }}</div>
                            </div>
                        </template>
                        <template v-for="h in headers" :key="'c' + h.key" #[`item.${h.key}`]="{ item }">
                            {{ cell((item as any)[h.key]) }}
                        </template>
                        <template #no-data>데이터가 없습니다.</template>
                    </v-data-table>
                </template>
            </v-card>
        </div>
    </div>
</template>

<style scoped>
.browser-layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 12px;
    min-height: 420px;
}
.schema-list {
    overflow-y: auto;
    max-height: calc(100vh - 272px);
}
.class-item {
    padding-inline-start: 24px !important;
}
.class-detail {
    min-width: 0;
    overflow: hidden;
}
.empty-detail {
    height: 100%;
    min-height: 400px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}
.rows-table :deep(td),
.rows-table :deep(th) {
    white-space: nowrap;
}
.col-head {
    line-height: 1.25;
    padding: 4px 0;
}
.col-desc {
    font-size: 11px;
    font-weight: 400;
    color: rgba(var(--v-theme-on-surface), 0.55);
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
}
@media (max-width: 900px) {
    .browser-layout {
        grid-template-columns: 1fr;
    }
}
</style>

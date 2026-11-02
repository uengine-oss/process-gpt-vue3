<script setup lang="ts">
// 연관 관계 탭 — 실행 이력(폼 값)과 Studio 업무 데이터(예: 한우 식당)를 잇는 연결 규칙과, 단계별로 어떤 데이터를 쓰는지(spec 021).
// 규칙: "이 폼 필드 값이 Studio 이 클래스.속성 값과 같으면 이 관계로 잇는다". 적용하면 전체 다시 보내기로 Studio 그래프에 관계가 생긴다.
import { computed, onMounted, ref, watch } from 'vue';
import { ontologyDataApi, apiError, type LinkRule, type LinkSuggestion, type LinkUsage, type StudioSchema } from './ontologyDataApi';

const emit = defineEmits<{ (e: 'browse'): void }>();

const rules = ref<LinkRule[]>([]);
const processes = ref<{ id: string; name: string }[]>([]);
const schemas = ref<StudioSchema[]>([]);
const linkCounts = ref<Record<string, number>>({});
const loading = ref(false);
const error = ref<string | null>(null);
const snack = ref<{ show: boolean; text: string; color: string }>({ show: false, text: '', color: 'success' });

const suggestions = ref<LinkSuggestion[] | null>(null);
const suggesting = ref(false);
const applying = ref(false);
const dirty = ref(false); // 규칙을 바꾼 뒤 아직 적용(전체 다시 보내기) 안 함

const PG = ['PgProcess', 'PgActivity', 'PgInstance', 'PgWorkItem'];

async function load() {
    loading.value = true;
    error.value = null;
    try {
        const [r, p, s, settings] = await Promise.all([
            ontologyDataApi.linkRules(),
            ontologyDataApi.processDefinitions(),
            ontologyDataApi.studioSchemas(),
            ontologyDataApi.exportSettings()
        ]);
        rules.value = r;
        processes.value = p;
        schemas.value = s.schemas || [];
        linkCounts.value = settings?.last_result?.links || {};
        if (!usageProc.value) usageProc.value = defaultProc();
    } catch (e) {
        error.value = apiError(e);
    } finally {
        loading.value = false;
    }
}

const procName = (id: string) => (id ? processes.value.find((p) => p.id === id)?.name || id : '모든 프로세스');

// Studio 클래스(실행 이력 클래스 제외) → 속성
const classes = computed(() => {
    const m = new Map<string, Set<string>>();
    for (const s of schemas.value)
        for (const c of s.classes) {
            if (PG.includes(c.class_name)) continue;
            const props = m.get(c.class_name) || new Set<string>(['name']);
            for (const p of c.properties || []) props.add(p.name);
            m.set(c.class_name, props);
        }
    return [...m.entries()].map(([name, props]) => ({ name, props: [...props] })).sort((a, b) => a.name.localeCompare(b.name));
});
// 클래스가 원래 속한 스키마(실행 이력 스키마에 참조로 더해진 것은 빼고)
const schemaOf = (cls: string) =>
    schemas.value.find((s) => !s.classes.some((c) => PG.includes(c.class_name)) && s.classes.some((c) => c.class_name === cls))?.name || '';

// ---------------------------------------------------------------- 규칙 편집
const dialog = ref(false);
const form = ref<Partial<LinkRule>>({});
const saving = ref(false);
const formError = ref<string | null>(null);
const propsOfForm = computed(() => classes.value.find((c) => c.name === form.value.target_class)?.props || ['name']);
const procItems = computed(() => [{ id: '', name: '모든 프로세스' }, ...processes.value]);

function openNew(base?: Partial<LinkRule>) {
    form.value = { proc_def_id: '', field: '', target_class: '', match_prop: 'name', relation: '', description: '', enabled: true, ...base };
    formError.value = null;
    dialog.value = true;
}
function openEdit(r: LinkRule) {
    openNew({ ...r });
}
async function saveForm() {
    saving.value = true;
    formError.value = null;
    try {
        await ontologyDataApi.saveLinkRule({ ...form.value, relation: (form.value.relation || '').toUpperCase() });
        dialog.value = false;
        dirty.value = true;
        await load();
        if (suggestions.value) await suggest();
    } catch (e) {
        formError.value = apiError(e);
    } finally {
        saving.value = false;
    }
}
async function toggle(r: LinkRule) {
    try {
        await ontologyDataApi.saveLinkRule({ ...r, enabled: !r.enabled });
        dirty.value = true;
        await load();
    } catch (e) {
        snack.value = { show: true, text: apiError(e), color: 'error' };
    }
}
const confirmDelete = ref<LinkRule | null>(null);
async function remove() {
    const r = confirmDelete.value;
    confirmDelete.value = null;
    if (!r) return;
    await ontologyDataApi.deleteLinkRule(r.id);
    dirty.value = true;
    await load();
}

// ---------------------------------------------------------------- 추천
async function suggest() {
    suggesting.value = true;
    try {
        const res = await ontologyDataApi.suggestLinkRules();
        if (res.error) snack.value = { show: true, text: res.error, color: 'error' };
        suggestions.value = res.items;
    } catch (e) {
        snack.value = { show: true, text: apiError(e), color: 'error' };
    } finally {
        suggesting.value = false;
    }
}
function useSuggestion(s: LinkSuggestion) {
    openNew({
        proc_def_id: s.all_procs || s.procs.length !== 1 ? '' : s.procs[0].id,
        field: s.field,
        target_class: s.target_class,
        match_prop: s.match_prop,
        relation: s.relation,
        description: `${s.activities.join('·')} 단계의 ${s.field} = ${s.target_class}.${s.match_prop}`
    });
}

// ---------------------------------------------------------------- 적용
async function apply() {
    applying.value = true;
    try {
        const r = await ontologyDataApi.runExport(true);
        if (r.error) throw new Error(r.error);
        linkCounts.value = r.links || {};
        dirty.value = false;
        const total = Object.values(r.links || {}).reduce((a: number, b: any) => a + Number(b), 0);
        snack.value = { show: true, text: `적용했습니다 — 규칙 관계 ${total}건, 판단 단계 데이터 연결 ${r.data_uses ?? 0}건`, color: 'success' };
        if (usageProc.value) await loadUsage();
    } catch (e) {
        snack.value = { show: true, text: apiError(e), color: 'error' };
    } finally {
        applying.value = false;
    }
}

// ---------------------------------------------------------------- 단계별 데이터 사용
const usageProc = ref('');
const usage = ref<LinkUsage | null>(null);
const usageLoading = ref(false);
const showAllFields = ref(false);
function defaultProc() {
    const withRules = rules.value.find((r) => r.proc_def_id)?.proc_def_id;
    return withRules || processes.value.find((p) => p.id === 'rest-sirloin')?.id || processes.value[0]?.id || '';
}
async function loadUsage() {
    if (!usageProc.value) return;
    usageLoading.value = true;
    try {
        usage.value = await ontologyDataApi.linkUsage(usageProc.value);
    } catch (e) {
        usage.value = null;
        snack.value = { show: true, text: apiError(e), color: 'error' };
    } finally {
        usageLoading.value = false;
    }
}
watch(usageProc, loadUsage);
const visibleWrites = (step: LinkUsage['steps'][number]) => (showAllFields.value ? step.writes : step.writes.filter((w) => w.links.length));

onMounted(load);
</script>

<template>
    <div class="links-tab">
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-3">{{ error }}</v-alert>
        <v-progress-linear v-if="loading" indeterminate color="primary" />

        <v-card variant="outlined" class="pa-4 mb-3">
            <div class="d-flex align-center flex-wrap ga-2 mb-1">
                <span class="text-subtitle-1 font-weight-bold">연결 규칙</span>
                <v-spacer />
                <v-btn variant="outlined" size="small" :loading="suggesting" @click="suggest">
                    <v-icon start size="16">mdi-auto-fix</v-icon>추천 받기
                </v-btn>
                <v-btn variant="outlined" size="small" @click="openNew()"><v-icon start size="16">mdi-plus</v-icon>규칙 추가</v-btn>
                <v-btn color="primary" size="small" :loading="applying" @click="apply">
                    <v-icon start size="16">mdi-sync</v-icon>적용 (전체 다시 보내기)
                </v-btn>
            </div>
            <div class="text-body-2 text-medium-emphasis mb-3">
                프로세스 단계에서 입력된 폼 값이 Studio 업무 데이터(공급사·부위·등급 기준·판단 사례 등)의 값과 같으면, 정한 관계 이름으로 실행 이력
                (<code>PgWorkItem</code>·<code>PgInstance</code>)과 그 데이터를 잇습니다. 규칙이 없는 필드는 이름이 같을 때 <code>MENTIONS</code> 로만 이어집니다.
            </div>
            <v-alert v-if="dirty" type="info" variant="tonal" density="compact" class="mb-2">
                규칙을 바꿨습니다. <b>적용</b>을 눌러야 Studio 그래프에 반영됩니다.
            </v-alert>

            <table v-if="rules.length" class="mini-table">
                <thead>
                    <tr>
                        <th style="width: 56px">사용</th>
                        <th>폼 필드</th>
                        <th>프로세스</th>
                        <th>Studio 데이터</th>
                        <th>관계</th>
                        <th class="num">연결된 업무</th>
                        <th style="width: 90px"></th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="r in rules" :key="r.id" :class="{ 'text-disabled': !r.enabled }">
                        <td><v-switch :model-value="r.enabled" color="primary" density="compact" hide-details inset @update:model-value="toggle(r)" /></td>
                        <td><code>{{ r.field }}</code></td>
                        <td>{{ procName(r.proc_def_id) }}</td>
                        <td>
                            <code>{{ r.target_class }}.{{ r.match_prop }}</code>
                            <span v-if="schemaOf(r.target_class)" class="text-caption text-medium-emphasis ml-1">{{ schemaOf(r.target_class) }}</span>
                        </td>
                        <td>
                            <v-chip size="small" color="primary" variant="tonal" label>{{ r.relation }}</v-chip>
                            <div v-if="r.description" class="text-caption text-medium-emphasis">{{ r.description }}</div>
                        </td>
                        <td class="num">{{ linkCounts[r.relation] ?? 0 }}</td>
                        <td>
                            <v-btn icon size="x-small" variant="text" @click="openEdit(r)"><v-icon size="16">mdi-pencil</v-icon></v-btn>
                            <v-btn icon size="x-small" variant="text" color="error" @click="confirmDelete = r"><v-icon size="16">mdi-delete</v-icon></v-btn>
                        </td>
                    </tr>
                </tbody>
            </table>
            <div v-else-if="!loading" class="text-body-2 text-medium-emphasis py-2">아직 규칙이 없습니다. <b>추천 받기</b>로 시작하세요.</div>

            <template v-if="suggestions">
                <v-divider class="my-3" />
                <div class="d-flex align-center mb-2">
                    <span class="text-subtitle-2 font-weight-bold">추천</span>
                    <span class="text-caption text-medium-emphasis ml-2">
                        보낸 실행 이력의 폼 값과 Studio 데이터(마스터·사례)의 속성 값을 비교했습니다 · 일치율은 프로세스별로 계산
                    </span>
                    <v-spacer />
                    <v-btn size="x-small" variant="text" @click="suggestions = null">닫기</v-btn>
                </div>
                <div v-if="!suggestions.length" class="text-body-2 text-medium-emphasis">추천할 연결이 없습니다.</div>
                <table v-else class="mini-table">
                    <thead>
                        <tr><th>폼 필드</th><th>Studio 데이터</th><th>일치</th><th>예시 값</th><th>프로세스</th><th></th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="s in suggestions" :key="`${s.field}-${s.target_class}-${s.match_prop}`" :class="{ 'text-disabled': s.exists }">
                            <td><code>{{ s.field }}</code><div class="text-caption text-medium-emphasis">{{ s.activities.join(' · ') }}</div></td>
                            <td><code>{{ s.target_class }}.{{ s.match_prop }}</code></td>
                            <td style="min-width: 110px">
                                <v-progress-linear :model-value="s.share * 100" color="primary" height="6" rounded class="mb-1" />
                                <span class="text-caption">{{ s.matched }}/{{ s.distinct }} 값 ({{ Math.round(s.share * 100) }}%)</span>
                            </td>
                            <td>
                                <v-chip v-for="v in s.samples" :key="v" size="x-small" class="mr-1 mb-1" label>{{ v }}</v-chip>
                            </td>
                            <td class="text-caption">{{ s.all_procs ? '모든 프로세스' : s.procs.map((p) => p.name).join(', ') }}</td>
                            <td>
                                <span v-if="s.exists" class="text-caption">규칙 있음</span>
                                <v-btn v-else size="x-small" color="primary" variant="tonal" @click="useSuggestion(s)">규칙으로</v-btn>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </template>
        </v-card>

        <v-card variant="outlined" class="pa-4">
            <div class="d-flex align-center flex-wrap ga-2 mb-1">
                <span class="text-subtitle-1 font-weight-bold">단계별 데이터 사용</span>
                <v-spacer />
                <v-checkbox v-model="showAllFields" label="연결 없는 필드도 보기" density="compact" hide-details class="flex-grow-0" />
                <v-autocomplete
                    v-model="usageProc"
                    :items="processes"
                    item-title="name"
                    item-value="id"
                    density="compact"
                    hide-details
                    placeholder="프로세스"
                    style="max-width: 320px; min-width: 240px"
                />
            </div>
            <div class="text-body-2 text-medium-emphasis mb-3">
                각 단계가 판단에 <b>읽는</b> Studio 데이터(데이터셋 탭의 판단 설정)와, 단계가 <b>남기는</b> 폼 값이 이어지는 Studio 데이터입니다.
            </div>
            <v-progress-linear v-if="usageLoading" indeterminate color="primary" />
            <v-alert v-if="usage?.error" type="warning" variant="tonal" density="compact" class="mb-2">{{ usage.error }}</v-alert>
            <ol v-if="usage" class="steps">
                <li v-for="s in usage.steps" :key="s.activity_id" class="step">
                    <div class="d-flex align-center flex-wrap ga-2 mb-1">
                        <span class="font-weight-bold">{{ s.name }}</span>
                        <v-chip v-if="s.role" size="x-small" label variant="outlined">{{ s.role }}</v-chip>
                        <v-chip v-if="s.decision" size="x-small" label color="deep-purple" variant="tonal">
                            <v-icon start size="12">mdi-scale-balance</v-icon>판단: {{ s.decision.name }}
                        </v-chip>
                    </div>
                    <div v-if="s.decision" class="step-block">
                        <div class="step-label">읽는 데이터</div>
                        <div v-for="r in s.decision.reads" :key="r.class + r.role" class="read-row">
                            <code>{{ r.class }}</code><span v-if="r.filter" class="text-caption text-medium-emphasis ml-1">({{ r.filter }})</span>
                            <span class="text-body-2 ml-2">{{ r.role }}</span>
                        </div>
                    </div>
                    <div v-if="visibleWrites(s).length" class="step-block">
                        <div class="step-label">남기는 값 → 이어지는 데이터</div>
                        <div v-for="w in visibleWrites(s)" :key="w.field" class="read-row">
                            <code>{{ w.field }}</code>
                            <span class="text-caption text-medium-emphasis ml-1">예: {{ w.sample }}</span>
                            <template v-for="l in w.links" :key="l.rule_id">
                                <v-icon size="14" class="mx-1">mdi-arrow-right</v-icon>
                                <v-chip size="x-small" label color="primary" variant="tonal" :class="{ 'text-disabled': !l.enabled }">{{ l.relation }}</v-chip>
                                <code class="ml-1">{{ l.target_class }}.{{ l.match_prop }}</code>
                                <span class="text-caption text-medium-emphasis ml-1">{{ l.count }}건</span>
                            </template>
                        </div>
                    </div>
                    <div v-if="!s.decision && !visibleWrites(s).length" class="text-caption text-medium-emphasis">Studio 데이터와 이어진 값이 없습니다</div>
                </li>
            </ol>
            <div class="d-flex mt-2">
                <v-btn size="small" variant="outlined" @click="emit('browse')">
                    <v-icon start size="16">mdi-database-search-outline</v-icon>Studio 데이터 둘러보기
                </v-btn>
            </div>
        </v-card>

        <v-dialog v-model="dialog" max-width="560">
            <v-card>
                <v-card-title>{{ form.id ? '연결 규칙 수정' : '연결 규칙 추가' }}</v-card-title>
                <v-card-text>
                    <v-autocomplete v-model="form.proc_def_id" :items="procItems" item-title="name" item-value="id" label="프로세스" density="compact" class="mb-2" />
                    <v-text-field
                        v-model="form.field"
                        label="폼 필드 경로"
                        hint="폼 id 를 뺀 경로. 반복 행 안의 값은 점으로(예: quotes.supplier)"
                        persistent-hint
                        density="compact"
                        class="mb-3"
                    />
                    <div class="d-flex ga-2">
                        <v-autocomplete
                            v-model="form.target_class"
                            :items="classes.map((c) => c.name)"
                            label="Studio 클래스"
                            density="compact"
                            @update:model-value="form.match_prop = 'name'"
                        />
                        <v-autocomplete v-model="form.match_prop" :items="propsOfForm" label="비교할 속성" density="compact" />
                    </div>
                    <v-text-field
                        v-model="form.relation"
                        label="관계 이름"
                        hint="대문자·숫자·_ (예: ORDERED_FROM)"
                        persistent-hint
                        density="compact"
                        class="mb-3"
                        @update:model-value="(v: string) => (form.relation = (v || '').toUpperCase())"
                    />
                    <v-text-field v-model="form.description" label="설명" density="compact" />
                    <v-alert v-if="formError" type="error" variant="tonal" density="compact">{{ formError }}</v-alert>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="dialog = false">취소</v-btn>
                    <v-btn color="primary" :loading="saving" @click="saveForm">저장</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog :model-value="!!confirmDelete" max-width="420" @update:model-value="(v: boolean) => !v && (confirmDelete = null)">
            <v-card>
                <v-card-title>연결 규칙 삭제</v-card-title>
                <v-card-text>
                    <code>{{ confirmDelete?.field }}</code> → <code>{{ confirmDelete?.target_class }}.{{ confirmDelete?.match_prop }}</code>
                    ({{ confirmDelete?.relation }}) 규칙을 지웁니다. 적용하면 Studio 그래프에서 이 관계가 사라집니다.
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="confirmDelete = null">취소</v-btn>
                    <v-btn color="error" @click="remove">삭제</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
        <v-snackbar v-model="snack.show" :color="snack.color" timeout="3500">{{ snack.text }}</v-snackbar>
    </div>
</template>

<style scoped>
.mini-table {
    border-collapse: collapse;
    font-size: 13px;
    width: 100%;
}
.mini-table th,
.mini-table td {
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    padding: 6px 8px;
    text-align: left;
    vertical-align: middle;
}
.mini-table th {
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.7);
}
.mini-table .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
}
.steps {
    padding-left: 20px;
}
.step {
    padding: 10px 0;
    border-bottom: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity));
}
.step-block {
    margin: 4px 0 4px 2px;
}
.step-label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.6);
    margin-bottom: 2px;
}
.read-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    padding: 2px 0;
    font-size: 13px;
}
</style>

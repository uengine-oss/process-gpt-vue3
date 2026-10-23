<template>
    <v-container fluid class="pa-6">
        <div class="d-flex align-center mb-4 flex-wrap ga-3">
            <div>
                <h2 class="text-h5 font-weight-bold mb-1">{{ $t('mcpServerList.title') }}</h2>
                <div class="text-body-2 text-medium-emphasis">
                    {{ $t('mcpServerList.subtitle') }}
                </div>
            </div>
            <v-spacer />
            <v-btn variant="text" prepend-icon="mdi-book-open-variant" to="/mcp-hub/guide">
                {{ $t('mcpServerList.guide') }}
            </v-btn>
            <v-btn variant="tonal" prepend-icon="mdi-view-grid-plus" to="/mcp-hub/gallery">
                {{ $t('mcpServerList.addFromGallery') }}
            </v-btn>
            <v-btn variant="tonal" prepend-icon="mdi-code-json" @click="openJson">
                {{ $t('mcpServerList.editJson') }}
            </v-btn>
            <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">
                {{ $t('mcpServerList.register') }}
            </v-btn>
        </div>

        <!-- 상태 요약 -->
        <v-row class="mb-2" dense>
            <v-col v-for="s in healthTiles" :key="s.key" cols="6" sm="3">
                <v-card variant="tonal" :color="s.color" class="pa-3">
                    <div class="text-caption">{{ s.label }}</div>
                    <div class="text-h5 font-weight-bold">{{ s.count }}</div>
                </v-card>
            </v-col>
        </v-row>

        <v-row dense>
            <!-- 필터 -->
            <v-col cols="12" md="3">
                <v-card variant="outlined" class="pa-3">
                    <v-text-field
                        v-model="filters.q" density="compact" variant="outlined"
                        prepend-inner-icon="mdi-magnify" :label="$t('mcpServerList.filters.search')"
                        hide-details clearable class="mb-3" @update:model-value="debouncedLoad" />
                    <v-select
                        v-model="filters.category" :items="categories" :label="$t('mcpServerList.filters.category')"
                        density="compact" variant="outlined" hide-details clearable
                        class="mb-3" @update:model-value="load" />
                    <v-select
                        v-model="filters.department_id" :items="departments" :label="$t('mcpServerList.filters.department')"
                        density="compact" variant="outlined" hide-details clearable
                        class="mb-3" @update:model-value="load" />
                    <v-select
                        v-model="filters.health_state" :items="healthStates" :label="$t('mcpServerList.filters.healthState')"
                        density="compact" variant="outlined" hide-details clearable
                        @update:model-value="load" />
                </v-card>
            </v-col>

            <!-- 목록 -->
            <v-col cols="12" md="9">
                <v-card variant="outlined">
                    <v-data-table
                        :headers="headers" :items="servers" :loading="loading"
                        density="comfortable" items-per-page="25"
                        :no-data-text="$t('mcpServerList.noData')">
                        <template #item.name="{ item }">
                            <div class="d-flex align-center ga-2">
                                <v-icon size="18" :color="stateColor(item.health_state)">
                                    mdi-circle-medium
                                </v-icon>
                                <div>
                                    <RouterLink :to="`/mcp-hub/servers/${item.id}`"
                                        class="font-weight-medium text-primary text-decoration-none">
                                        {{ item.display_name || item.name }}
                                    </RouterLink>
                                    <div class="text-caption text-medium-emphasis">
                                        {{ item.name }}
                                    </div>
                                </div>
                            </div>
                        </template>

                        <template #item.department_id="{ item }">
                            <span v-if="item.department_id">{{ item.department_id }}</span>
                            <span v-else class="text-disabled">—</span>
                        </template>

                        <template #item.transport="{ item }">
                            <v-chip size="x-small" variant="tonal">{{ item.transport || '—' }}</v-chip>
                            <span class="text-caption text-medium-emphasis ml-2">
                                v{{ item.version ?? '—' }}
                            </span>
                        </template>

                        <template #item.health_state="{ item }">
                            <v-chip size="small" :color="stateColor(item.health_state)" variant="flat">
                                {{ stateLabel(item.health_state) }}
                            </v-chip>
                            <div v-if="item.latency_ms != null" class="text-caption text-medium-emphasis">
                                {{ item.latency_ms }}ms
                                <template v-if="item.availability_24h != null">
                                    · {{ $t('mcpServerList.availability', { n: item.availability_24h }) }}
                                </template>
                            </div>
                        </template>

                        <template #item.tool_count="{ item }">
                            <span class="tabular">{{ item.tool_count }}</span>
                        </template>

                        <template #item.calls_24h="{ item }">
                            <span class="tabular">{{ item.calls_24h ?? 0 }}</span>
                            <div v-if="item.error_rate_24h != null"
                                class="text-caption"
                                :class="item.error_rate_24h > 5 ? 'text-error' : 'text-medium-emphasis'">
                                {{ $t('mcpServerList.errorRate', { n: item.error_rate_24h }) }}
                                <template v-if="item.p95_ms != null"> · p95 {{ item.p95_ms }}ms</template>
                            </div>
                        </template>

                        <template #item.enabled="{ item }">
                            <v-switch
                                :model-value="item.enabled" color="primary" density="compact"
                                hide-details inset :disabled="item.is_default"
                                @update:model-value="(v) => toggle(item, v)" />
                        </template>

                        <template #item.actions="{ item }">
                            <v-btn icon="mdi-lan-connect" size="small" variant="text"
                                :loading="checking === item.id" :title="$t('mcpServerList.checkNow')"
                                @click="checkNow(item)" />
                            <v-btn icon="mdi-open-in-new" size="small" variant="text"
                                :to="`/mcp-hub/servers/${item.id}`" :title="$t('mcpServerList.detail')" />
                        </template>
                    </v-data-table>
                </v-card>
            </v-col>
        </v-row>

        <!-- 등록 마법사 -->
        <v-dialog v-model="createOpen" max-width="720" persistent>
            <v-card>
                <v-card-title class="d-flex align-center">
                    {{ $t('mcpServerList.create.title') }}
                    <v-spacer />
                    <v-btn icon="mdi-close" variant="text" @click="createOpen = false" />
                </v-card-title>
                <v-divider />
                <v-card-text>
                    <v-row dense>
                        <v-col cols="12" sm="6">
                            <v-text-field v-model="draft.name" :label="$t('mcpServerList.create.name')"
                                :hint="$t('mcpServerList.create.nameHint')" persistent-hint
                                density="compact" variant="outlined" />
                        </v-col>
                        <v-col cols="12" sm="6">
                            <v-text-field v-model="draft.display_name" :label="$t('mcpServerList.create.displayName')"
                                density="compact" variant="outlined" />
                        </v-col>
                        <v-col cols="12">
                            <v-text-field v-model="draft.description" :label="$t('mcpServerList.create.description')"
                                density="compact" variant="outlined" />
                        </v-col>
                        <v-col cols="12" sm="4">
                            <v-select v-model="draft.connection.transport"
                                :items="['streamable-http', 'sse', 'stdio']" :label="$t('mcpServerList.create.transport')"
                                density="compact" variant="outlined" />
                        </v-col>
                        <v-col cols="12" sm="4">
                            <v-text-field v-model="draft.category" :label="$t('mcpServerList.create.category')"
                                density="compact" variant="outlined" />
                        </v-col>
                        <v-col cols="12" sm="4">
                            <v-text-field v-model="draft.department_id" :label="$t('mcpServerList.create.department')"
                                density="compact" variant="outlined" />
                        </v-col>

                        <template v-if="draft.connection.transport === 'stdio'">
                            <v-col cols="12" sm="4">
                                <v-text-field v-model="draft.connection.command" label="command *"
                                    density="compact" variant="outlined" />
                            </v-col>
                            <v-col cols="12" sm="8">
                                <v-text-field v-model="argsText" :label="$t('mcpServerList.create.args')"
                                    density="compact" variant="outlined" />
                            </v-col>
                        </template>
                        <template v-else>
                            <v-col cols="12">
                                <v-text-field v-model="draft.connection.url" label="URL *"
                                    placeholder="http://my-service:8000/mcp"
                                    density="compact" variant="outlined" />
                            </v-col>
                        </template>
                    </v-row>

                    <v-alert v-if="probe" class="mt-2" density="compact"
                        :type="probe.status === 'success' ? 'success' : 'error'" variant="tonal">
                        <div v-if="probe.status === 'success'">
                            {{ $t('mcpServerList.create.probeSuccess', { n: probe.tools?.length || 0 }) }}
                            <div class="mt-2 d-flex flex-wrap ga-1">
                                <v-chip v-for="t in probe.tools" :key="t.name" size="x-small"
                                    variant="outlined">{{ t.name }}</v-chip>
                            </div>
                        </div>
                        <div v-else>{{ $t('mcpServerList.create.probeFail', { error: probe.error_message }) }}</div>
                    </v-alert>
                </v-card-text>
                <v-divider />
                <v-card-actions>
                    <v-btn variant="text" prepend-icon="mdi-lan-pending"
                        :loading="probing" @click="testConnection">{{ $t('mcpServerList.create.test') }}</v-btn>
                    <v-spacer />
                    <v-btn variant="text" @click="createOpen = false">{{ $t('mcpServerList.cancel') }}</v-btn>
                    <v-btn color="primary" :loading="saving" :disabled="!draft.name"
                        @click="save">{{ $t('mcpServerList.create.submit') }}</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- JSON 편집 (기존 등록 방식) -->
        <v-dialog v-model="jsonOpen" max-width="900" persistent>
            <v-card>
                <v-card-title class="d-flex align-center">
                    {{ $t('mcpServerList.editJson') }}
                    <v-spacer />
                    <v-btn icon="mdi-close" variant="text" @click="jsonOpen = false" />
                </v-card-title>
                <v-divider />
                <v-card-text>
                    <div class="text-body-2 text-medium-emphasis mb-3">
                        {{ $t('mcpServerList.json.helpPrefix') }}<code>mcpServers</code>{{ $t('mcpServerList.json.helpSuffix') }}
                    </div>
                    <div style="height: 420px; border: 1px solid rgba(0,0,0,.15); border-radius: 4px">
                        <vue-monaco-editor
                            v-model:value="jsonText" language="json"
                            :options="{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true }" />
                    </div>
                    <v-checkbox v-model="jsonPrune" density="compact" hide-details class="mt-2"
                        :label="$t('mcpServerList.json.prune')" />
                    <v-alert v-if="jsonError" type="error" variant="tonal" density="compact" class="mt-2">
                        {{ jsonError }}
                    </v-alert>
                    <v-alert v-if="jsonResult" type="success" variant="tonal" density="compact" class="mt-2">
                        {{ jsonResult }}
                    </v-alert>
                </v-card-text>
                <v-divider />
                <v-card-actions>
                    <v-btn variant="text" prepend-icon="mdi-download" @click="downloadJson">
                        {{ $t('mcpServerList.json.export') }}
                    </v-btn>
                    <v-spacer />
                    <v-btn variant="text" @click="jsonOpen = false">{{ $t('mcpServerList.cancel') }}</v-btn>
                    <v-btn color="primary" :loading="jsonSaving" @click="saveJson">{{ $t('mcpServerList.save') }}</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-snackbar v-model="snack.open" :color="snack.color" timeout="4000">
            {{ snack.text }}
        </v-snackbar>
    </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import mcpHubApi, { type McpServerSummary } from '@/services/mcpHubApi';

const { t } = useI18n();

const servers = ref<McpServerSummary[]>([]);
const loading = ref(false);
const checking = ref<string | null>(null);
const createOpen = ref(false);
const saving = ref(false);
const probing = ref(false);
const probe = ref<any>(null);
const snack = ref({ open: false, text: '', color: 'success' });

const filters = ref<Record<string, any>>({
    q: '', category: null, department_id: null, health_state: null
});

const healthStates = computed(() => [
    { title: t('mcpServerList.state.healthy'), value: 'healthy' },
    { title: t('mcpServerList.state.degraded'), value: 'degraded' },
    { title: t('mcpServerList.state.unhealthy'), value: 'unhealthy' },
    { title: t('mcpServerList.state.unknown'), value: 'unknown' }
]);

const headers = computed(() => [
    { title: t('mcpServerList.headers.server'), key: 'name' },
    { title: t('mcpServerList.headers.department'), key: 'department_id' },
    { title: t('mcpServerList.headers.connection'), key: 'transport' },
    { title: t('mcpServerList.headers.status'), key: 'health_state' },
    { title: t('mcpServerList.headers.tools'), key: 'tool_count', align: 'end' as const },
    { title: t('mcpServerList.headers.calls24h'), key: 'calls_24h', align: 'end' as const },
    { title: t('mcpServerList.headers.enabled'), key: 'enabled', sortable: false, align: 'center' as const },
    { title: '', key: 'actions', sortable: false, align: 'end' as const }
]);

const categories = computed(() =>
    [...new Set(servers.value.map((s) => s.category).filter(Boolean))] as string[]);
const departments = computed(() =>
    [...new Set(servers.value.map((s) => s.department_id).filter(Boolean))] as string[]);

const healthTiles = computed(() => {
    const by = (st: string) => servers.value.filter((s) => (s.health_state || 'unknown') === st).length;
    return [
        { key: 'healthy', label: t('mcpServerList.state.healthy'), count: by('healthy'), color: 'success' },
        { key: 'degraded', label: t('mcpServerList.state.degraded'), count: by('degraded'), color: 'warning' },
        { key: 'unhealthy', label: t('mcpServerList.state.unhealthy'), count: by('unhealthy'), color: 'error' },
        { key: 'unknown', label: t('mcpServerList.state.unknown'), count: by('unknown'), color: 'grey' }
    ];
});

// --- JSON 편집 (기존 등록 방식 유지) ---
const jsonOpen = ref(false);
const jsonText = ref('');
const jsonSaving = ref(false);
const jsonPrune = ref(true);
const jsonError = ref('');
const jsonResult = ref('');

async function openJson() {
    jsonError.value = '';
    jsonResult.value = '';
    try {
        const blob = await mcpHubApi.exportJson();
        jsonText.value = JSON.stringify(blob, null, 2);
        jsonOpen.value = true;
    } catch (e: any) {
        notify(t('mcpServerList.json.loadFailed', { error: e.message }), 'error');
    }
}

function downloadJson() {
    // 브라우저 다운로드 대신 클립보드로 — 뷰어 환경에 따라 다운로드가 막힌다.
    navigator.clipboard?.writeText(jsonText.value)
        .then(() => notify(t('mcpServerList.json.copied')))
        .catch(() => notify(t('mcpServerList.json.copyFailed'), 'warning'));
}

async function saveJson() {
    jsonError.value = '';
    jsonResult.value = '';
    let parsed: any;
    try {
        parsed = JSON.parse(jsonText.value);
    } catch (e: any) {
        jsonError.value = t('mcpServerList.json.invalid', { error: e.message });
        return;
    }
    const servers = parsed?.mcpServers;
    if (!servers || typeof servers !== 'object') {
        jsonError.value = t('mcpServerList.json.missingRoot');
        return;
    }

    jsonSaving.value = true;
    try {
        const r = await mcpHubApi.importJson(servers, { prune: jsonPrune.value });
        const parts = [];
        if (r.created?.length) parts.push(t('mcpServerList.json.created', { n: r.created.length }));
        if (r.updated?.length) parts.push(t('mcpServerList.json.updated', { n: r.updated.length }));
        if (r.removed?.length) parts.push(t('mcpServerList.json.removed', { n: r.removed.length }));
        if (r.unchanged?.length) parts.push(t('mcpServerList.json.unchanged', { n: r.unchanged.length }));
        jsonResult.value = parts.length ? parts.join(' · ') : t('mcpServerList.json.noChanges');
        await load();
    } catch (e: any) {
        jsonError.value = e.response?.data?.detail || e.message;
    } finally {
        jsonSaving.value = false;
    }
}

const draft = ref<any>({
    name: '', display_name: '', description: '', category: '', department_id: '',
    connection: { transport: 'streamable-http', url: '', command: '', args: [] }
});
const argsText = ref('');

function stateColor(s?: string | null) {
    return { healthy: 'success', degraded: 'warning', unhealthy: 'error' }[s || ''] || 'grey';
}
function stateLabel(s?: string | null) {
    const key = ['healthy', 'degraded', 'unhealthy'].includes(s || '') ? s : 'unknown';
    return t(`mcpServerList.state.${key}`);
}
function notify(text: string, color = 'success') {
    snack.value = { open: true, text, color };
}

async function load() {
    loading.value = true;
    try {
        const params: Record<string, any> = {};
        Object.entries(filters.value).forEach(([k, v]) => { if (v) params[k] = v; });
        servers.value = await mcpHubApi.listServers(params);
    } catch (e: any) {
        notify(t('mcpServerList.loadFailed', { error: e.message }), 'error');
    } finally {
        loading.value = false;
    }
}

let debounceTimer: any = null;
function debouncedLoad() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(load, 300);
}

function openCreate() {
    probe.value = null;
    argsText.value = '';
    draft.value = {
        name: '', display_name: '', description: '', category: '', department_id: '',
        connection: { transport: 'streamable-http', url: '', command: '', args: [] }
    };
    createOpen.value = true;
}

function connectionPayload() {
    const c = { ...draft.value.connection };
    c.args = argsText.value.trim() ? argsText.value.trim().split(/\s+/) : [];
    return c;
}

async function testConnection() {
    probing.value = true;
    probe.value = null;
    try {
        probe.value = await mcpHubApi.validateConnection(
            connectionPayload(), draft.value.name || 'preview');
    } catch (e: any) {
        probe.value = { status: 'error', error_message: e.message };
    } finally {
        probing.value = false;
    }
}

async function save() {
    saving.value = true;
    try {
        await mcpHubApi.createServer({
            name: draft.value.name,
            display_name: draft.value.display_name || null,
            description: draft.value.description || null,
            category: draft.value.category || null,
            department_id: draft.value.department_id || null,
            connection: connectionPayload()
        });
        notify(t('mcpServerList.registered', { name: draft.value.name }));
        createOpen.value = false;
        await load();
    } catch (e: any) {
        notify(e.response?.data?.detail || t('mcpServerList.registerFailed', { error: e.message }), 'error');
    } finally {
        saving.value = false;
    }
}

async function toggle(item: McpServerSummary, value: boolean) {
    try {
        await mcpHubApi.updateServer(item.id, { enabled: value });
        item.enabled = value;
        notify(value
            ? t('mcpServerList.enabledMsg', { name: item.name })
            : t('mcpServerList.disabledMsg', { name: item.name }));
    } catch (e: any) {
        notify(t('mcpServerList.toggleFailed', { error: e.message }), 'error');
        await load();
    }
}

async function checkNow(item: McpServerSummary) {
    checking.value = item.id;
    try {
        const r = await mcpHubApi.forceHealthCheck(item.id);
        notify(r.status === 'success'
            ? t('mcpServerList.checkOk', { name: item.name, n: r.tools?.length || 0 })
            : t('mcpServerList.checkFail', { name: item.name, error: r.error_message }),
            r.status === 'success' ? 'success' : 'error');
        await load();
    } catch (e: any) {
        notify(t('mcpServerList.checkFailed', { error: e.message }), 'error');
    } finally {
        checking.value = null;
    }
}

let poll: any = null;
onMounted(() => {
    load();
    // 헬스는 서버가 주기적으로 갱신하므로 가볍게 폴링한다.
    poll = setInterval(load, 30000);
});
onUnmounted(() => clearInterval(poll));
</script>

<style scoped>
.tabular { font-variant-numeric: tabular-nums; }
/* 컬럼이 좁아도 헤더가 세로로 접히지 않게 한다. */
:deep(.v-data-table th) { white-space: nowrap; }
</style>

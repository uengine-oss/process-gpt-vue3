<template>
    <v-container fluid class="pa-6">
        <div class="d-flex align-center mb-4 flex-wrap ga-3">
            <div>
                <h2 class="text-h5 font-weight-bold mb-1">{{ $t('mcpObservability.title') }}</h2>
                <div class="text-body-2 text-medium-emphasis">
                    {{ $t('mcpObservability.subtitle') }}
                </div>
            </div>
            <v-spacer />
            <v-btn-toggle v-model="range" mandatory density="compact" variant="outlined"
                @update:model-value="load">
                <v-btn value="1h">{{ $t('mcpObservability.range.1h') }}</v-btn>
                <v-btn value="24h">{{ $t('mcpObservability.range.24h') }}</v-btn>
                <v-btn value="7d">{{ $t('mcpObservability.range.7d') }}</v-btn>
                <v-btn value="30d">{{ $t('mcpObservability.range.30d') }}</v-btn>
            </v-btn-toggle>
        </div>

        <!-- KPI -->
        <v-row dense class="mb-2">
            <v-col v-for="k in kpis" :key="k.label" cols="6" md="3" lg="2">
                <v-card variant="outlined" class="pa-3">
                    <div class="text-caption text-medium-emphasis">{{ k.label }}</div>
                    <div class="text-h5 font-weight-bold tabular" :class="k.class">
                        {{ k.value }}
                    </div>
                    <div v-if="k.sub" class="text-caption text-medium-emphasis">{{ k.sub }}</div>
                </v-card>
            </v-col>
        </v-row>

        <v-row dense>
            <v-col cols="12" lg="7">
                <v-card variant="outlined" class="mb-3">
                    <v-card-title class="text-subtitle-1">{{ $t('mcpObservability.byServer') }}</v-card-title>
                    <v-data-table :headers="serverHeaders" :items="serverStats" :loading="loading"
                        density="compact" items-per-page="10"
                        :no-data-text="$t('mcpObservability.noServerCalls')">
                        <template #item.error_rate="{ item }">
                            <span :class="(item.error_rate ?? 0) > 5 ? 'text-error font-weight-bold' : ''">
                                {{ item.error_rate ?? 0 }}%
                            </span>
                        </template>
                        <template #item.last_error="{ item }">
                            <span class="text-caption text-error">
                                {{ (item.last_error || '').slice(0, 60) }}
                            </span>
                        </template>
                    </v-data-table>
                </v-card>

                <v-card variant="outlined">
                    <v-card-title class="text-subtitle-1">{{ $t('mcpObservability.byTool') }}</v-card-title>
                    <v-data-table :headers="toolHeaders" :items="toolStats" :loading="loading"
                        density="compact" items-per-page="10"
                        :no-data-text="$t('mcpObservability.noToolCalls')" />
                </v-card>
            </v-col>

            <v-col cols="12" lg="5">
                <v-card variant="outlined" class="mb-3">
                    <v-card-title class="text-subtitle-1">{{ $t('mcpObservability.recentCalls') }}</v-card-title>
                    <v-list density="compact" class="calls">
                        <v-list-item v-for="c in calls" :key="c.id" @click="selected = c">
                            <template #prepend>
                                <v-icon size="16"
                                    :color="c.status === 'success' ? 'success' : 'error'">
                                    {{ c.status === 'success' ? 'mdi-check-circle' : 'mdi-alert-circle' }}
                                </v-icon>
                            </template>
                            <v-list-item-title class="text-body-2">
                                {{ c.server_name }} · {{ c.tool_name }}
                            </v-list-item-title>
                            <v-list-item-subtitle class="text-caption">
                                {{ fmt(c.started_at) }} · {{ c.duration_ms }}ms
                                <span v-if="c.engine"> · {{ c.engine }}</span>
                                <span v-if="c.error_type" class="text-error"> · {{ c.error_type }}</span>
                            </v-list-item-subtitle>
                        </v-list-item>
                        <v-list-item v-if="!calls.length">
                            <v-list-item-title class="text-body-2 text-medium-emphasis">
                                {{ $t('mcpObservability.noCalls') }}
                            </v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-card>

                <v-card variant="outlined">
                    <v-card-title class="text-subtitle-1">LLM</v-card-title>
                    <v-card-text>
                        <div class="d-flex justify-space-between mb-1">
                            <span class="text-body-2">{{ $t('mcpObservability.llm.calls') }}</span>
                            <span class="tabular">{{ summary.llm_calls ?? 0 }}</span>
                        </div>
                        <div class="d-flex justify-space-between mb-1">
                            <span class="text-body-2">{{ $t('mcpObservability.llm.tokens') }}</span>
                            <span class="tabular">{{ (summary.total_tokens ?? 0).toLocaleString() }}</span>
                        </div>
                        <div class="d-flex justify-space-between">
                            <span class="text-body-2">{{ $t('mcpObservability.llm.cost') }}</span>
                            <span class="tabular">${{ summary.cost_usd ?? 0 }}</span>
                        </div>
                        <v-divider class="my-3" />
                        <div class="text-caption text-medium-emphasis">
                            {{ $t('mcpObservability.llm.note') }}
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>

        <!-- 호출 상세 -->
        <v-navigation-drawer v-model="drawerOpen" location="right" temporary width="480">
            <div v-if="selected" class="pa-4">
                <div class="d-flex align-center mb-3">
                    <h3 class="text-subtitle-1 font-weight-bold">{{ $t('mcpObservability.detail.title') }}</h3>
                    <v-spacer />
                    <v-btn icon="mdi-close" variant="text" size="small" @click="selected = null" />
                </div>
                <v-chip size="small" class="mb-3"
                    :color="selected.status === 'success' ? 'success' : 'error'" variant="flat">
                    {{ selected.status }}
                </v-chip>
                <dl class="detail">
                    <dt>{{ $t('mcpObservability.detail.server') }}</dt><dd>{{ selected.server_name }}</dd>
                    <dt>{{ $t('mcpObservability.detail.tool') }}</dt><dd>{{ selected.tool_name }}</dd>
                    <dt>{{ $t('mcpObservability.detail.engine') }}</dt><dd>{{ selected.engine || '—' }}</dd>
                    <dt>{{ $t('mcpObservability.detail.duration') }}</dt><dd class="tabular">{{ selected.duration_ms }}ms</dd>
                    <dt>{{ $t('mcpObservability.detail.process') }}</dt><dd class="mono">{{ selected.proc_inst_id || '—' }}</dd>
                    <dt>{{ $t('mcpObservability.detail.workitem') }}</dt><dd class="mono">{{ selected.todo_id || '—' }}</dd>
                    <dt>trace</dt><dd class="mono">{{ selected.trace_id || '—' }}</dd>
                </dl>
                <div v-if="selected.error_message" class="mt-3">
                    <div class="text-caption text-medium-emphasis mb-1">{{ $t('mcpObservability.detail.error') }}</div>
                    <v-alert type="error" variant="tonal" density="compact">
                        {{ selected.error_message }}
                    </v-alert>
                </div>
                <div class="mt-3">
                    <div class="text-caption text-medium-emphasis mb-1">{{ $t('mcpObservability.detail.input') }}</div>
                    <pre class="payload">{{ pretty(selected.input_preview) }}</pre>
                </div>
                <div class="mt-3">
                    <div class="text-caption text-medium-emphasis mb-1">{{ $t('mcpObservability.detail.output') }}</div>
                    <pre class="payload">{{ pretty(selected.output_preview) }}</pre>
                </div>
            </div>
        </v-navigation-drawer>
    </v-container>
</template>

<script setup lang="ts">
import { dateLocale } from '@/composables/dateLocale';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import mcpHubApi from '@/services/mcpHubApi';

const { t, locale } = useI18n();
const range = ref('24h');
const loading = ref(false);
const summary = ref<any>({});
const serverStats = ref<any[]>([]);
const toolStats = ref<any[]>([]);
const calls = ref<any[]>([]);
const selected = ref<any>(null);

const drawerOpen = computed({
    get: () => !!selected.value,
    set: (v: boolean) => { if (!v) selected.value = null; }
});

const serverHeaders = computed(() => [
    { title: t('mcpObservability.headers.server'), key: 'server_name' },
    { title: t('mcpObservability.headers.calls'), key: 'calls', align: 'end' as const },
    { title: t('mcpObservability.headers.failed'), key: 'failed', align: 'end' as const },
    { title: t('mcpObservability.headers.errorRate'), key: 'error_rate', align: 'end' as const },
    { title: 'p50', key: 'p50_ms', align: 'end' as const },
    { title: 'p95', key: 'p95_ms', align: 'end' as const },
    { title: t('mcpObservability.headers.lastError'), key: 'last_error' }
]);
const toolHeaders = computed(() => [
    { title: t('mcpObservability.headers.server'), key: 'server_name' },
    { title: t('mcpObservability.headers.tool'), key: 'tool_name' },
    { title: t('mcpObservability.headers.calls'), key: 'calls', align: 'end' as const },
    { title: t('mcpObservability.headers.failed'), key: 'failed', align: 'end' as const },
    { title: 'p95', key: 'p95_ms', align: 'end' as const }
]);

const kpis = computed(() => [
    { label: t('mcpObservability.kpi.totalCalls'), value: (summary.value.calls ?? 0).toLocaleString() },
    {
        label: t('mcpObservability.kpi.successRate'),
        value: summary.value.success_rate != null ? `${summary.value.success_rate}%` : '—',
        class: (summary.value.success_rate ?? 100) < 95 ? 'text-error' : ''
    },
    { label: t('mcpObservability.kpi.p95'), value: summary.value.p95_ms != null ? `${summary.value.p95_ms}ms` : '—' },
    {
        label: t('mcpObservability.kpi.healthyServers'),
        value: summary.value.healthy ?? 0,
        sub: t('mcpObservability.kpi.totalServers', { n: summary.value.servers?.total ?? 0 })
    },
    {
        label: t('mcpObservability.kpi.unhealthyServers'),
        value: (summary.value.unhealthy ?? 0) + (summary.value.degraded ?? 0),
        class: (summary.value.unhealthy ?? 0) > 0 ? 'text-error' : ''
    },
    { label: t('mcpObservability.kpi.llmCalls'), value: (summary.value.llm_calls ?? 0).toLocaleString() }
]);

function fmt(ts: string) {
    if (!ts) return '';
    // 표시 언어를 따라간다. 이 값을 dateLocale() 로 고정해 두면 영어 화면에서도 한국어 날짜가 나온다.
    return new Date(ts).toLocaleString(locale.value === 'ko' ? dateLocale() : 'en-US', { hour12: false });
}
function pretty(v: any) {
    if (v == null) return '—';
    try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

async function load() {
    loading.value = true;
    try {
        const [s, srv, tools, cs] = await Promise.all([
            mcpHubApi.obsSummary(range.value),
            mcpHubApi.obsServers(range.value),
            mcpHubApi.obsTools(range.value, 20),
            mcpHubApi.obsCalls({ limit: 40 })
        ]);
        summary.value = s;
        serverStats.value = srv;
        toolStats.value = tools;
        calls.value = cs;
    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
}

onMounted(load);
</script>

<style scoped>
.tabular { font-variant-numeric: tabular-nums; }
/* 컬럼이 좁아도 헤더가 세로로 접히지 않게 한다. */
:deep(.v-data-table th) { white-space: nowrap; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; word-break: break-all; }
.detail { display: grid; grid-template-columns: 90px 1fr; gap: 6px 12px; font-size: 13px; }
.detail dt { color: rgba(var(--v-theme-on-surface), 0.6); }
.detail dd { margin: 0; }
.payload {
    background: rgba(var(--v-theme-on-surface), 0.05);
    padding: 10px; border-radius: 4px; font-size: 11px;
    max-height: 220px; overflow: auto; white-space: pre-wrap; word-break: break-all;
}
.calls { max-height: 420px; overflow-y: auto; }
</style>

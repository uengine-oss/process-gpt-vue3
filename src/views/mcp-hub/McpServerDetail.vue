<template>
    <v-container fluid class="pa-6">
        <div v-if="server" class="d-flex align-center mb-4 flex-wrap ga-2">
            <v-btn icon="mdi-arrow-left" variant="text" to="/mcp-hub" />
            <div>
                <h2 class="text-h5 font-weight-bold mb-1">
                    {{ server.display_name || server.name }}
                    <v-chip size="small" :color="stateColor" variant="flat" class="ml-2">
                        {{ stateLabel }}
                    </v-chip>
                </h2>
                <div class="text-body-2 text-medium-emphasis">
                    {{ server.name }}
                    <span v-if="server.department_id"> · {{ server.department_id }}</span>
                    <span v-if="server.category"> · {{ server.category }}</span>
                </div>
            </div>
            <v-spacer />
            <v-btn variant="tonal" prepend-icon="mdi-refresh" :loading="refreshing"
                @click="refresh">{{ $t('mcpServerDetail.refreshTools') }}</v-btn>
        </div>

        <v-tabs v-model="tab" class="mb-4">
            <v-tab value="overview">{{ $t('mcpServerDetail.tabs.overview') }}</v-tab>
            <v-tab value="tools">{{ $t('mcpServerDetail.tabs.tools', { n: tools.length }) }}</v-tab>
            <v-tab value="versions">{{ $t('mcpServerDetail.tabs.versions', { n: versions.length }) }}</v-tab>
            <v-tab value="permissions">{{ $t('mcpServerDetail.tabs.permissions') }}</v-tab>
            <v-tab value="health">{{ $t('mcpServerDetail.tabs.health') }}</v-tab>
            <v-tab value="calls">{{ $t('mcpServerDetail.tabs.calls') }}</v-tab>
        </v-tabs>

        <!-- 개요 -->
        <v-card v-if="tab === 'overview' && server" variant="outlined" class="pa-4">
            <v-row>
                <v-col cols="12" md="6">
                    <dl class="detail">
                        <dt>{{ $t('mcpServerDetail.overview.transport') }}</dt><dd>{{ server.transport }}</dd>
                        <dt v-if="server.url">URL</dt><dd v-if="server.url" class="mono">{{ server.url }}</dd>
                        <dt v-if="server.command">command</dt>
                        <dd v-if="server.command" class="mono">
                            {{ server.command }} {{ (server.args || []).join(' ') }}
                        </dd>
                        <dt>{{ $t('mcpServerDetail.overview.currentVersion') }}</dt><dd>v{{ server.version }}</dd>
                        <dt>{{ $t('mcpServerDetail.overview.owner') }}</dt><dd>{{ server.owner_email || '—' }}</dd>
                        <dt>{{ $t('mcpServerDetail.overview.source') }}</dt><dd>{{ server.source }}</dd>
                    </dl>
                </v-col>
                <v-col cols="12" md="6">
                    <dl class="detail">
                        <dt>{{ $t('mcpServerDetail.overview.healthState') }}</dt><dd>{{ stateLabel }}</dd>
                        <dt>{{ $t('mcpServerDetail.overview.latency') }}</dt><dd class="tabular">{{ server.latency_ms ?? '—' }}ms</dd>
                        <dt>{{ $t('mcpServerDetail.overview.availability24h') }}</dt><dd class="tabular">{{ server.availability_24h ?? '—' }}%</dd>
                        <dt>{{ $t('mcpServerDetail.overview.consecutiveFailures') }}</dt><dd class="tabular">{{ server.consecutive_failures ?? 0 }}</dd>
                    </dl>
                    <v-alert v-if="server.health_error" type="error" variant="tonal"
                        density="compact" class="mt-3">{{ server.health_error }}</v-alert>
                </v-col>
            </v-row>
            <div v-if="server.description" class="mt-3 text-body-2">{{ server.description }}</div>
        </v-card>

        <!-- 툴 -->
        <v-card v-if="tab === 'tools'" variant="outlined">
            <v-expansion-panels variant="accordion">
                <v-expansion-panel v-for="t in tools" :key="t.id">
                    <v-expansion-panel-title>
                        <div>
                            <span class="font-weight-medium">{{ t.tool_name }}</span>
                            <v-chip v-if="!t.is_available" size="x-small" color="warning"
                                variant="tonal" class="ml-2">{{ $t('mcpServerDetail.tools.gone') }}</v-chip>
                            <div class="text-caption text-medium-emphasis">
                                {{ (t.description || '').split('\n')[0] }}
                            </div>
                        </div>
                    </v-expansion-panel-title>
                    <v-expansion-panel-text>
                        <pre class="payload">{{ pretty(t.input_schema) }}</pre>
                    </v-expansion-panel-text>
                </v-expansion-panel>
            </v-expansion-panels>
            <v-card-text v-if="!tools.length" class="text-medium-emphasis">
                {{ $t('mcpServerDetail.tools.empty') }}
            </v-card-text>
        </v-card>

        <!-- 버전 -->
        <v-card v-if="tab === 'versions'" variant="outlined">
            <v-data-table :headers="versionHeaders" :items="versions" density="compact"
                items-per-page="20">
                <template #item.current="{ item }">
                    <v-chip v-if="item.version === server?.version" size="x-small"
                        color="primary" variant="flat">{{ $t('mcpServerDetail.versions.current') }}</v-chip>
                </template>
                <template #item.target="{ item }">
                    <span class="mono">{{ item.url || `${item.command} ${(item.args || []).join(' ')}` }}</span>
                </template>
                <template #item.actions="{ item }">
                    <v-btn v-if="item.version !== server?.version" size="x-small" variant="tonal"
                        @click="activate(item.version)">{{ $t('mcpServerDetail.versions.activate') }}</v-btn>
                </template>
            </v-data-table>
        </v-card>

        <!-- 권한 -->
        <v-card v-if="tab === 'permissions'" variant="outlined" class="pa-4">
            <div class="text-body-2 text-medium-emphasis mb-3">
                {{ $t('mcpServerDetail.permissions.help') }}
            </div>
            <v-table density="compact">
                <thead>
                    <tr>
                        <th>{{ $t('mcpServerDetail.permissions.headers.principalType') }}</th>
                        <th>{{ $t('mcpServerDetail.permissions.headers.principal') }}</th>
                        <th>{{ $t('mcpServerDetail.permissions.headers.permission') }}</th>
                        <th>{{ $t('mcpServerDetail.permissions.headers.allowedTools') }}</th>
                        <th>{{ $t('mcpServerDetail.permissions.headers.deniedTools') }}</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(p, i) in permissions" :key="i">
                        <td style="width:150px">
                            <v-select v-model="p.principal_type" :items="principalTypes"
                                density="compact" variant="plain" hide-details />
                        </td>
                        <td>
                            <v-text-field v-model="p.principal_id" density="compact"
                                variant="plain" hide-details :placeholder="$t('mcpServerDetail.permissions.all')" />
                        </td>
                        <td style="width:120px">
                            <v-select v-model="p.permission" :items="['use', 'manage', 'none']"
                                density="compact" variant="plain" hide-details />
                        </td>
                        <td>
                            <v-text-field :model-value="(p.allowed_tools || []).join(',')"
                                density="compact" variant="plain" hide-details :placeholder="$t('mcpServerDetail.permissions.all')"
                                @update:model-value="(v) => p.allowed_tools = csv(v)" />
                        </td>
                        <td>
                            <v-text-field :model-value="(p.denied_tools || []).join(',')"
                                density="compact" variant="plain" hide-details
                                @update:model-value="(v) => p.denied_tools = csv(v) || []" />
                        </td>
                        <td style="width:48px">
                            <v-btn icon="mdi-delete" size="x-small" variant="text"
                                @click="permissions.splice(i, 1)" />
                        </td>
                    </tr>
                </tbody>
            </v-table>
            <div class="d-flex ga-2 mt-3">
                <v-btn variant="tonal" size="small" prepend-icon="mdi-plus" @click="addPermission">
                    {{ $t('mcpServerDetail.permissions.addRow') }}
                </v-btn>
                <v-spacer />
                <v-btn color="primary" size="small" :loading="savingPerms" @click="savePermissions">
                    {{ $t('mcpServerDetail.save') }}
                </v-btn>
            </div>
        </v-card>

        <!-- 헬스 -->
        <v-card v-if="tab === 'health'" variant="outlined">
            <v-data-table :headers="healthHeaders" :items="health" density="compact"
                items-per-page="25" :no-data-text="$t('mcpServerDetail.health.noData')">
                <template #item.state="{ item }">
                    <v-chip size="x-small" variant="flat"
                        :color="{ healthy: 'success', degraded: 'warning' }[item.state] || 'error'">
                        {{ item.state }}
                    </v-chip>
                </template>
            </v-data-table>
        </v-card>

        <!-- 호출 이력 -->
        <v-card v-if="tab === 'calls'" variant="outlined">
            <v-data-table :headers="callHeaders" :items="calls" density="compact"
                items-per-page="25" :no-data-text="$t('mcpServerDetail.calls.noData')">
                <template #item.status="{ item }">
                    <v-chip size="x-small" variant="flat"
                        :color="item.status === 'success' ? 'success' : 'error'">
                        {{ item.status }}
                    </v-chip>
                </template>
                <template #item.proc_inst_id="{ item }">
                    <span class="mono">{{ item.proc_inst_id || '—' }}</span>
                </template>
            </v-data-table>
        </v-card>

        <v-snackbar v-model="snack.open" :color="snack.color" timeout="4000">
            {{ snack.text }}
        </v-snackbar>
    </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import mcpHubApi from '@/services/mcpHubApi';

const { t } = useI18n();
const route = useRoute();
const id = route.params.id as string;

const server = ref<any>(null);
const tools = ref<any[]>([]);
const versions = ref<any[]>([]);
const permissions = ref<any[]>([]);
const health = ref<any[]>([]);
const calls = ref<any[]>([]);
const tab = ref('overview');
const refreshing = ref(false);
const savingPerms = ref(false);
const snack = ref({ open: false, text: '', color: 'success' });

const principalTypes = ['tenant', 'department', 'role', 'user', 'agent'];
const versionHeaders = computed(() => [
    { title: '', key: 'current', sortable: false, width: 70 },
    { title: t('mcpServerDetail.versions.headers.version'), key: 'version' },
    { title: t('mcpServerDetail.versions.headers.transport'), key: 'transport' },
    { title: t('mcpServerDetail.versions.headers.target'), key: 'target', sortable: false },
    { title: t('mcpServerDetail.versions.headers.note'), key: 'change_note' },
    { title: t('mcpServerDetail.versions.headers.created'), key: 'created_at' },
    { title: '', key: 'actions', sortable: false, align: 'end' as const }
]);
const healthHeaders = computed(() => [
    { title: t('mcpServerDetail.health.headers.checkedAt'), key: 'checked_at' },
    { title: t('mcpServerDetail.health.headers.state'), key: 'state' },
    { title: t('mcpServerDetail.health.headers.latencyMs'), key: 'latency_ms', align: 'end' as const },
    { title: t('mcpServerDetail.health.headers.toolCount'), key: 'tool_count', align: 'end' as const },
    { title: t('mcpServerDetail.health.headers.error'), key: 'error_message' }
]);
const callHeaders = computed(() => [
    { title: t('mcpServerDetail.calls.headers.startedAt'), key: 'started_at' },
    { title: t('mcpServerDetail.calls.headers.tool'), key: 'tool_name' },
    { title: t('mcpServerDetail.calls.headers.status'), key: 'status' },
    { title: t('mcpServerDetail.calls.headers.durationMs'), key: 'duration_ms', align: 'end' as const },
    { title: t('mcpServerDetail.calls.headers.engine'), key: 'engine' },
    { title: t('mcpServerDetail.calls.headers.process'), key: 'proc_inst_id' }
]);

const stateColor = computed(() =>
    ({ healthy: 'success', degraded: 'warning', unhealthy: 'error' } as any)[
        server.value?.health_state] || 'grey');
const stateLabel = computed(() => {
    const s = server.value?.health_state;
    const key = ['healthy', 'degraded', 'unhealthy'].includes(s) ? s : 'unknown';
    return t(`mcpServerDetail.state.${key}`);
});

function pretty(v: any) {
    try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}
function csv(v: string) {
    const parts = (v || '').split(',').map((s) => s.trim()).filter(Boolean);
    return parts.length ? parts : null;
}
function notify(text: string, color = 'success') {
    snack.value = { open: true, text, color };
}

async function load() {
    const [srv, vers, perms, hp, cs] = await Promise.all([
        mcpHubApi.getServer(id),
        mcpHubApi.listVersions(id),
        mcpHubApi.getPermissions(id),
        mcpHubApi.serverHealth(id),
        mcpHubApi.obsCalls({ server_id: id, limit: 100 })
    ]);
    server.value = srv;
    tools.value = srv.tools || [];
    versions.value = vers;
    permissions.value = perms;
    health.value = hp;
    calls.value = cs;
}

async function refresh() {
    refreshing.value = true;
    try {
        tools.value = await mcpHubApi.refreshTools(id);
        await load();
        notify(t('mcpServerDetail.refreshOk', { n: tools.value.length }));
    } catch (e: any) {
        notify(t('mcpServerDetail.refreshFailed', { error: e.message }), 'error');
    } finally {
        refreshing.value = false;
    }
}

async function activate(version: number) {
    await mcpHubApi.activateVersion(id, version);
    await load();
    notify(t('mcpServerDetail.versions.activated', { version }));
}

function addPermission() {
    permissions.value.push({
        principal_type: 'tenant', principal_id: null,
        permission: 'use', allowed_tools: null, denied_tools: []
    });
}

async function savePermissions() {
    savingPerms.value = true;
    try {
        await mcpHubApi.setPermissions(id, permissions.value);
        notify(t('mcpServerDetail.permissions.saved'));
    } catch (e: any) {
        notify(t('mcpServerDetail.permissions.saveFailed', { error: e.message }), 'error');
    } finally {
        savingPerms.value = false;
    }
}

onMounted(load);
</script>

<style scoped>
.tabular { font-variant-numeric: tabular-nums; }
/* 컬럼이 좁아도 헤더가 세로로 접히지 않게 한다. */
:deep(.v-data-table th) { white-space: nowrap; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; word-break: break-all; }
.detail { display: grid; grid-template-columns: 110px 1fr; gap: 8px 14px; font-size: 13px; }
.detail dt { color: rgba(var(--v-theme-on-surface), 0.6); }
.detail dd { margin: 0; }
.payload {
    background: rgba(var(--v-theme-on-surface), 0.05);
    padding: 10px; border-radius: 4px; font-size: 11px;
    max-height: 300px; overflow: auto;
}
</style>

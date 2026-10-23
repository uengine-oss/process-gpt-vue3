<template>
    <v-container fluid class="pa-6">
        <div class="d-flex align-center mb-4">
            <div>
                <h2 class="text-h5 font-weight-bold mb-1">{{ $t('mcpGuide.title') }}</h2>
                <div class="text-body-2 text-medium-emphasis">
                    {{ $t('mcpGuide.subtitle') }}
                </div>
            </div>
            <v-spacer />
            <v-btn variant="text" prepend-icon="mdi-arrow-left" to="/mcp-hub">{{ $t('mcpGuide.backToList') }}</v-btn>
        </div>

        <v-tabs v-model="tab" class="mb-4">
            <v-tab value="layers">{{ $t('mcpGuide.tabs.layers') }}</v-tab>
            <v-tab value="standard">{{ $t('mcpGuide.tabs.standard') }}</v-tab>
            <v-tab value="check">{{ $t('mcpGuide.tabs.check') }}</v-tab>
        </v-tabs>

        <!-- 계층 개요 -->
        <div v-if="tab === 'layers'">
            <v-card variant="tonal" color="primary" class="pa-5 mb-4">
                <div class="text-overline mb-2">{{ $t('mcpGuide.criteria.title') }}</div>
                <div class="text-body-1 mb-2">
                    <strong>{{ $t('mcpGuide.criteria.processCond') }}</strong>
                    {{ $t('mcpGuide.criteria.processResult') }}
                </div>
                <div class="text-body-1 mb-2">
                    <strong>{{ $t('mcpGuide.criteria.n8nCond') }}</strong>
                    {{ $t('mcpGuide.criteria.n8nResult') }}
                </div>
                <div class="text-body-1 mb-3">
                    <strong>{{ $t('mcpGuide.criteria.toolCond') }}</strong> {{ $t('mcpGuide.criteria.toolResult') }}
                </div>
                <v-divider class="mb-3" />
                <div class="text-body-2">
                    {{ $t('mcpGuide.criteria.notePrefix') }}<strong>{{ $t('mcpGuide.criteria.noteStrong') }}</strong>{{ $t('mcpGuide.criteria.noteSuffix') }}
                </div>
            </v-card>

            <v-card variant="outlined" class="pa-5 mb-4">
                <div class="layer l1">
                    <div class="lname">{{ $t('mcpGuide.layers.processName') }} <em>Orchestration</em></div>
                    <p class="ldesc">
                        {{ $t('mcpGuide.layers.processDesc') }}
                    </p>
                    <div class="lbody">
                        <div class="layer l2">
                            <div class="lname">{{ $t('mcpGuide.layers.automationName') }} <em>Automation</em></div>
                            <p class="ldesc">
                                {{ $t('mcpGuide.layers.automationDesc') }}
                            </p>
                            <div class="lbody">
                                <div class="lname">{{ $t('mcpGuide.layers.capabilityName') }} <em>Capability</em></div>
                                <p class="ldesc">{{ $t('mcpGuide.layers.capabilityDesc') }}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="text-center text-caption text-medium-emphasis mt-4">
                    {{ $t('mcpGuide.layers.containment') }}
                </div>
            </v-card>

            <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">{{ $t('mcpGuide.comparison.title') }}</v-card-title>
                <v-table density="compact">
                    <thead>
                        <tr>
                            <th>{{ $t('mcpGuide.comparison.aspect') }}</th>
                            <th>{{ $t('mcpGuide.comparison.n8n') }}</th>
                            <th>{{ $t('mcpGuide.comparison.process') }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="r in comparison" :key="r[0]">
                            <td class="font-weight-medium">{{ r[0] }}</td>
                            <td>{{ r[1] }}</td>
                            <td>{{ r[2] }}</td>
                        </tr>
                    </tbody>
                </v-table>
            </v-card>
        </div>

        <!-- 연계 표준 -->
        <v-card v-if="tab === 'standard'" variant="outlined">
            <v-list density="comfortable">
                <v-list-item v-for="r in guide.rules || []" :key="r.id">
                    <template #prepend>
                        <v-chip size="x-small" class="mr-3"
                            :color="isRequiredLevel(r.level) ? 'error' : 'warning'" variant="tonal">
                            {{ levelLabel(r.level) }}
                        </v-chip>
                    </template>
                    <v-list-item-title class="text-body-2">{{ r.text }}</v-list-item-title>
                    <v-list-item-subtitle v-if="r.why || r.example" class="text-caption mt-1">
                        <span v-if="r.why">{{ r.why }}</span>
                        <code v-if="r.example" class="ml-1">{{ r.example }}</code>
                    </v-list-item-subtitle>
                </v-list-item>
            </v-list>
        </v-card>

        <!-- 적합성 검사 -->
        <v-card v-if="tab === 'check'" variant="outlined" class="pa-4">
            <div class="text-body-2 text-medium-emphasis mb-3">
                {{ $t('mcpGuide.check.intro') }}
            </div>
            <v-row dense>
                <v-col cols="12" sm="3">
                    <v-select v-model="conn.transport" :items="['streamable-http', 'sse', 'stdio']"
                        :label="$t('mcpGuide.check.transport')" density="compact" variant="outlined" />
                </v-col>
                <v-col cols="12" sm="7">
                    <v-text-field v-if="conn.transport !== 'stdio'" v-model="conn.url"
                        label="URL" density="compact" variant="outlined" />
                    <v-text-field v-else v-model="conn.command" label="command"
                        density="compact" variant="outlined" />
                </v-col>
                <v-col cols="12" sm="2">
                    <v-btn color="primary" block :loading="checking" @click="runCheck">{{ $t('mcpGuide.check.run') }}</v-btn>
                </v-col>
            </v-row>

            <div v-if="report" class="mt-4">
                <div class="d-flex align-center ga-3 mb-3">
                    <v-avatar size="48" :color="gradeColor" class="text-h5 font-weight-bold">
                        {{ report.grade }}
                    </v-avatar>
                    <div>
                        <div class="text-body-1 font-weight-medium">
                            {{ report.connected ? $t('mcpGuide.check.connected') : $t('mcpGuide.check.failed') }}
                            · {{ $t('mcpGuide.check.toolCount', { n: report.tool_count }) }}
                        </div>
                        <div v-if="report.violations?.length" class="text-caption text-error">
                            {{ $t('mcpGuide.check.violations', { n: report.violations.length }) }}
                        </div>
                    </div>
                </div>
                <v-table density="compact">
                    <tbody>
                        <tr v-for="f in report.findings" :key="f.rule">
                            <td style="width:60px">
                                <v-icon size="18" :color="f.pass ? 'success' : 'error'">
                                    {{ f.pass ? 'mdi-check-circle' : 'mdi-close-circle' }}
                                </v-icon>
                            </td>
                            <td style="width:70px">
                                <v-chip size="x-small" variant="tonal"
                                    :color="isRequiredLevel(f.level) ? 'error' : 'warning'">
                                    {{ levelLabel(f.level) }}
                                </v-chip>
                            </td>
                            <td class="font-weight-medium" style="width:140px">{{ f.rule }}</td>
                            <td class="text-body-2">{{ f.detail }}</td>
                        </tr>
                    </tbody>
                </v-table>
            </div>
        </v-card>
    </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import mcpHubApi from '@/services/mcpHubApi';

const { t } = useI18n();
const tab = ref('layers');
const guide = ref<any>({});
const conn = ref<any>({ transport: 'streamable-http', url: '', command: '', args: [] });
const report = ref<any>(null);
const checking = ref(false);

// 백엔드가 내려주는 level 값('필수' / '권장')을 화면 표기용 문구로 바꾼다.
// level 은 백엔드가 '필수'/'권장' 으로 내려주지만, 영어 클라이언트에는 응답 미들웨어가
// 이미 'Required'/'Recommended' 로 바꿔서 보낸다. 한쪽만 비교하면 영어 화면에서 필수 규칙이
// 전부 '권장' 으로 떨어지므로 두 표기를 모두 인정한다.
const isRequiredLevel = (level: string) => level === '필수' || level === 'Required';

const levelLabel = (level: string) =>
    isRequiredLevel(level) ? t('mcpGuide.level.required') : t('mcpGuide.level.recommended');

const comparisonRowKeys = [
    'position', 'modeling', 'lifetime', 'human', 'state', 'roles',
    'branching', 'errors', 'observability', 'audit', 'change', 'examples'
];

const comparison = computed<string[][]>(() => comparisonRowKeys.map((k) => [
    t(`mcpGuide.comparison.rows.${k}.aspect`),
    t(`mcpGuide.comparison.rows.${k}.n8n`),
    t(`mcpGuide.comparison.rows.${k}.process`)
]));

const gradeColor = computed(() =>
    ({ A: 'success', B: 'warning', C: 'error' } as any)[report.value?.grade] || 'grey');

async function runCheck() {
    checking.value = true;
    report.value = null;
    try {
        report.value = await mcpHubApi.conformance(conn.value);
    } catch (e: any) {
        report.value = {
            grade: 'C', connected: false, tool_count: 0,
            findings: [{ rule: 'request', level: '필수', pass: false, detail: e.message }],
            violations: [e.message]
        };
    } finally {
        checking.value = false;
    }
}

onMounted(async () => {
    guide.value = await mcpHubApi.specGuide();
});
</script>

<style scoped>
.layer { border: 1px solid rgba(var(--v-theme-on-surface), 0.2); border-radius: 6px; padding: 16px; }
.l1 { border-color: rgb(var(--v-theme-primary)); }
.lbody {
    margin-top: 14px; padding: 14px;
    border: 1px dashed rgba(var(--v-theme-on-surface), 0.25);
    border-radius: 5px;
    background: rgba(var(--v-theme-on-surface), 0.03);
}
.lname { font-weight: 600; font-size: 15px; }
.lname em { font-style: normal; font-size: 10px; letter-spacing: 0.11em;
    text-transform: uppercase; opacity: 0.6; margin-left: 8px; }
.ldesc { font-size: 13px; opacity: 0.8; margin: 6px 0 0; line-height: 1.5; }
</style>

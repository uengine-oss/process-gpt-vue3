<template>
    <div class="pa-4">
        <div class="d-flex align-center mb-4">
            <div>
                <h2 class="text-h6 mb-1">{{ $t('definitionBottlenecks.title') }}</h2>
                <div class="text-caption text-medium-emphasis">
                    {{ procDefId }} · {{ $t('definitionBottlenecks.instanceCount', { n: data?.instance_count ?? 0 }) }}
                </div>
            </div>
            <v-spacer />
            <v-btn variant="text" size="small" @click="load">
                <v-icon start>mdi-refresh</v-icon>{{ $t('definitionBottlenecks.reload') }}
            </v-btn>
        </div>

        <v-alert v-if="data?.note" type="info" variant="tonal" density="compact" class="mb-4">
            {{ data.note }}
        </v-alert>

        <v-card variant="outlined">
            <v-data-table
                :headers="headers"
                :items="rows"
                :loading="loading"
                :sort-by="[{ key: 'human_work_sec', order: 'desc' }]"
                density="comfortable"
                items-per-page="25"
            >
                <template #item.activity_name="{ item }">
                    <div class="d-flex align-center">
                        <span
                            v-if="item.is_top_human"
                            class="crit-dot"
                            :title="$t('definitionBottlenecks.topHumanTooltip')"
                        />
                        <span>{{ item.activity_name || item.activity_id || '—' }}</span>
                    </div>
                </template>

                <template #item.human_work_sec="{ item }">
                    <span class="num strong">{{ fmtLong(item.human_work_sec) }}</span>
                </template>
                <template #item.agent_work_sec="{ item }">
                    <span class="num">{{ fmtLong(item.agent_work_sec) }}</span>
                </template>
                <template #item.queue_wait_sec="{ item }">
                    <span class="num">{{ fmtLong(item.queue_wait_sec) }}</span>
                </template>
                <template #item.human_work_p90="{ item }">
                    <span class="num">{{ item.human_work_p90 ? fmtLong(item.human_work_p90) : '—' }}</span>
                </template>
                <template #item.mix="{ item }">
                    <div class="mix">
                        <span class="mix-h" :style="{ width: pct(item, 'human_work_sec') + '%' }" />
                        <span class="mix-a" :style="{ width: pct(item, 'agent_work_sec') + '%' }" />
                        <span class="mix-q" :style="{ width: pct(item, 'queue_wait_sec') + '%' }" />
                    </div>
                </template>

                <template #no-data>
                    <div class="pa-6 text-center text-medium-emphasis">
                        {{ $t('definitionBottlenecks.noData') }}
                    </div>
                </template>
            </v-data-table>
        </v-card>

        <div class="legend mt-3">
            <span><i class="mix-h" /> {{ $t('definitionBottlenecks.legend.human') }}</span>
            <span><i class="mix-a" /> {{ $t('definitionBottlenecks.legend.agent') }}</span>
            <span><i class="mix-q" /> {{ $t('definitionBottlenecks.legend.queue') }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { timelineApi } from '@/services/analyticsApi';
import { formatDurationLong } from '@/composables/useDuration';

const route = useRoute();
const { t } = useI18n();
const procDefId = String(route.params.procDefId ?? '');
const data = ref<any>(null);
const loading = ref(false);
const fmtLong = formatDurationLong;

const headers = computed(() => [
    { title: t('definitionBottlenecks.headers.activity'), key: 'activity_name' },
    { title: t('definitionBottlenecks.headers.mix'), key: 'mix', sortable: false, width: 140 },
    { title: t('definitionBottlenecks.headers.human'), key: 'human_work_sec', align: 'end' as const },
    { title: t('definitionBottlenecks.headers.agent'), key: 'agent_work_sec', align: 'end' as const },
    { title: t('definitionBottlenecks.headers.queue'), key: 'queue_wait_sec', align: 'end' as const },
    { title: t('definitionBottlenecks.headers.humanP90'), key: 'human_work_p90', align: 'end' as const },
    { title: t('definitionBottlenecks.headers.tasks'), key: 'task_count', align: 'end' as const }
]);

const rows = computed(() => {
    const list = data.value?.activities ?? [];
    const maxHuman = Math.max(...list.map((a: any) => a.human_work_sec ?? 0), 0);
    return list.map((a: any) => ({
        ...a,
        is_top_human: maxHuman > 0 && a.human_work_sec === maxHuman
    }));
});

function pct(item: any, key: string) {
    const denom = (item.human_work_sec ?? 0) + (item.agent_work_sec ?? 0) + (item.queue_wait_sec ?? 0);
    return denom > 0 ? ((item[key] ?? 0) / denom) * 100 : 0;
}

async function load() {
    loading.value = true;
    try {
        data.value = await timelineApi.getBottlenecks(procDefId);
    } finally {
        loading.value = false;
    }
}
onMounted(load);
</script>

<style scoped>
.num { font-variant-numeric: tabular-nums; }
.strong { font-weight: 600; }

.crit-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #C2410C; margin-right: 8px; flex: none;
}

.mix { display: flex; height: 8px; border-radius: 3px; overflow: hidden;
       background: rgba(120,120,120,0.12); }
.mix > span { height: 100%; }
.mix-h { background: #C2410C; }
.mix-a { background: #1D6F8B; }
.mix-q { background: #8A8A8A; }

.legend { display: flex; gap: 16px; font-size: 12px; opacity: 0.75; }
.legend i { display: inline-block; width: 10px; height: 10px;
            border-radius: 2px; margin-right: 5px; }
</style>

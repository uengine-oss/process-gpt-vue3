<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { fetchProcessAnalytics, type ProcessAnalyticsData } from '@/services/dashboardDataService';
import { useAnalysisDashboardStore } from '@/stores/analytics/analysisDashboardStore';
const props = defineProps<{ filters?: { domains?: string[] } }>();
const store = useAnalysisDashboardStore();
const data = ref<ProcessAnalyticsData | null>(null);
const loading = ref(false);
const error = ref('');
const search = ref('');
const summary = computed(() => data.value?.model_summary);
const rows = computed(() => (data.value?.task_ratio || []).filter(row => row.name.toLowerCase().includes(search.value.toLowerCase())));
const inDomain = (row: { domain: string }) => !props.filters?.domains?.length || props.filters.domains.includes(row.domain);
const zombies = computed(() => store.zombieProcesses.filter(inDomain));
const delayedReviews = computed(() => store.delayedReviews.filter(inDomain));
const pendingReopens = computed(() => store.pendingReopens.filter(inDomain));
const taskCount = (tasks: Record<string, number>) => Object.values(tasks).reduce((sum, count) => sum + count, 0);
const ratio = (count: number, total: number) => total ? `${Math.round(count / total * 100)}%` : '대상 없음';
let generation = 0;
async function load() {
    const request = ++generation;
    loading.value = true;
    error.value = '';
    try {
        const result = await fetchProcessAnalytics(props.filters?.domains);
        if (request === generation) data.value = result;
    } catch (e: any) {
        if (request === generation) error.value = e?.message || String(e);
    } finally {
        if (request === generation) loading.value = false;
    }
}
watch(() => props.filters?.domains, load, { immediate: true, deep: true });
defineExpose({ reload: load });
async function refresh() {
    await Promise.all([load(), store.fetchAllTabB()]);
}
</script>

<template>
    <v-container fluid class="pa-5">
        <div class="d-flex align-center justify-space-between mb-4">
            <div><h2 class="text-h5">프로세스 구성 현황</h2><p class="text-body-2 text-medium-emphasis">현재 등록된 순서도의 Task와 역할·시스템 연결을 집계합니다.</p></div>
            <v-btn variant="text" :loading="loading || store.loading" @click="refresh">새로고침</v-btn>
        </div>
        <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
        <v-progress-linear v-if="loading" indeterminate class="mb-4" />
        <template v-if="summary">
            <v-row>
                <v-col v-for="card in [
                    { label: '분석 프로세스', value: `${summary.process_count}개` },
                    { label: '전체 Task', value: `${summary.task_count}개` },
                    { label: '역할 지정 Task', value: ratio(summary.role_assigned_count, summary.task_count) },
                    { label: '시스템 연결 Task', value: ratio(summary.system_mapped_count, summary.task_count) }
                ]" :key="card.label" cols="12" sm="6" lg="3">
                    <v-card variant="outlined" class="pa-5"><p>{{ card.label }}</p><strong class="text-h4">{{ card.value }}</strong></v-card>
                </v-col>
                <v-col cols="12"><v-card variant="outlined" class="pa-5">
                    <h3 class="text-h6">프로세스별 Task 구성</h3>
                    <p class="text-body-2 text-medium-emphasis mb-3">Task 수는 순서도의 규모입니다. 처리시간·투입인력·실행 병목을 의미하지 않습니다.</p>
                    <v-text-field v-model="search" label="프로세스 검색" density="compact" variant="outlined" hide-details class="mb-3" />
                    <v-table><thead><tr><th>프로세스</th><th>도메인</th><th>Task 수</th><th>자동 처리 Task 비율</th></tr></thead>
                        <tbody><tr v-for="row in rows" :key="row.proc_def_id">
                            <td><router-link :to="`/definitions/${encodeURIComponent(row.proc_def_id || '')}`">{{ row.name }}</router-link></td>
                            <td>{{ row.domain }}</td><td>{{ taskCount(row.tasks) }}</td><td>{{ row.automation_score ?? 0 }}%</td>
                        </tr></tbody>
                    </v-table>
                    <p v-if="!rows.length" class="pa-5 text-center text-medium-emphasis">{{ search ? '검색 결과가 없습니다.' : 'Task가 포함된 순서도를 등록하면 표시됩니다.' }}</p>
                </v-card></v-col>
            </v-row>
        </template>
        <v-alert v-if="store.error" type="error" variant="tonal" class="mt-4">{{ store.error }}</v-alert>
        <v-row class="mt-2">
            <v-col cols="12" md="6"><v-card variant="outlined" class="pa-5 h-100">
                <h3 class="text-h6">장기 미갱신 프로세스</h3>
                <p class="text-body-2 text-medium-emphasis mb-3">90일 이상 저장하지 않은 초안·검토 중 프로세스</p>
                <div v-for="row in zombies" :key="row.proc_def_id" class="d-flex justify-space-between py-2">
                    <span>{{ row.proc_def_name || row.proc_def_id }}</span><span>{{ row.days_since_update }}일</span>
                </div>
                <p v-if="!store.loading && !store.error && !zombies.length" class="text-medium-emphasis">조건에 해당하는 프로세스가 없습니다.</p>
            </v-card></v-col>
            <v-col cols="12" md="6"><v-card variant="outlined" class="pa-5 h-100">
                <h3 class="text-h6">검토 및 재개 요청</h3>
                <p class="text-body-2 text-medium-emphasis mb-3">승인 이력에 등록된 검토 지연 및 재개 대기 현황</p>
                <div v-for="row in delayedReviews" :key="`review-${row.proc_def_id}`" class="py-2">{{ row.proc_def_name }} · 검토 지연 {{ row.days_delayed }}일</div>
                <div v-for="row in pendingReopens" :key="`reopen-${row.proc_def_id}`" class="py-2">{{ row.proc_def_name }} · 재개 대기 {{ row.days_pending }}일</div>
                <p v-if="!store.loading && !store.error && !delayedReviews.length && !pendingReopens.length" class="text-medium-emphasis">검토 지연 또는 재개 대기 요청이 없습니다.</p>
            </v-card></v-col>
        </v-row>
    </v-container>
</template>

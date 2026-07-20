<template>
    <v-card elevation="0" class="pa-4">
        <div class="d-flex align-center flex-wrap gap-2 mb-4">
            <h3 class="text-h6 mr-4">요청 유형 Top List</h3>
            <v-select
                v-if="!lockedDef"
                v-model="selectedDef"
                :items="procDefItems"
                item-title="title"
                item-value="value"
                density="compact"
                variant="outlined"
                hide-details
                label="프로세스 정의"
                style="max-width: 340px"
                @update:modelValue="loadTopList"
            />
            <v-btn-toggle v-model="period" density="compact" variant="outlined" divided mandatory
                class="ml-3" @update:modelValue="loadTopList">
                <v-btn v-for="opt in periodOptions" :key="opt.value" :value="opt.value" size="small">
                    {{ opt.label }}
                </v-btn>
            </v-btn-toggle>
            <v-spacer />
            <!-- 목록 / 트리맵 보기 전환 -->
            <v-btn-toggle v-model="viewMode" density="compact" variant="outlined" divided mandatory class="mr-3">
                <v-btn value="list" size="small" title="목록"><v-icon size="small">mdi-format-list-bulleted</v-icon></v-btn>
                <v-btn value="treemap" size="small" title="트리맵"><v-icon size="small">mdi-chart-tree</v-icon></v-btn>
            </v-btn-toggle>
            <v-btn size="small" variant="tonal" :loading="reclustering" @click="recluster" v-if="selectedDef">
                <v-icon start size="small">mdi-refresh</v-icon>재클러스터링
            </v-btn>
        </div>

        <div v-if="summary" class="d-flex align-center mb-3 text-body-2 text-medium-emphasis">
            <span class="mr-4">총 {{ summary.total }}건</span>
            <span>미분류(노이즈) 비율 {{ (summary.noise_ratio * 100).toFixed(1) }}%</span>
            <v-chip v-if="summary.noise_ratio > 0.3" size="x-small" color="warning" class="ml-2">
                노이즈 30% 초과 — MIN_CLUSTER_SIZE 조정 권장
            </v-chip>
        </div>

        <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-2" />

        <!-- 트리맵 보기: 면적으로 비율을 보여준다 -->
        <div v-if="viewMode === 'treemap' && items.length" class="mt-2">
            <apexchart type="treemap" height="520" :options="treemapOptions" :series="treemapSeries" />
        </div>

        <v-table density="comfortable" v-else-if="items.length">
            <thead>
                <tr>
                    <th style="width: 60px">순위</th>
                    <th>유형명</th>
                    <th>대표 키워드</th>
                    <th style="width: 90px" class="text-right">건수</th>
                    <th style="width: 90px" class="text-right">비율</th>
                    <th style="width: 120px">최근 발생</th>
                    <th style="width: 80px"></th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(row, idx) in items" :key="row.topic_id"
                    :class="{ 'text-medium-emphasis': row.is_noise }">
                    <td>{{ row.is_noise ? '—' : rankOf(idx) }}</td>
                    <td>
                        <v-icon v-if="row.is_noise" size="x-small" class="mr-1">mdi-help-circle-outline</v-icon>
                        {{ row.topic_name }}
                    </td>
                    <td class="text-caption text-truncate" style="max-width: 260px">{{ row.keywords }}</td>
                    <td class="text-right">{{ row.count }}</td>
                    <td class="text-right">{{ row.pct }}%</td>
                    <td class="text-caption">{{ fmtDate(row.last_seen) }}</td>
                    <td>
                        <v-btn size="x-small" variant="text" @click="openTopic(row)">보기</v-btn>
                    </td>
                </tr>
            </tbody>
        </v-table>

        <v-alert v-else-if="!loading && selectedDef" type="info" variant="tonal" density="compact">
            아직 분류된 인스턴스가 없습니다. 인스턴스가 쌓이면 자동으로 유형이 생성됩니다.
        </v-alert>
        <v-alert v-else-if="!loading && !procDefItems.length" type="info" variant="tonal" density="compact">
            인제스천된 프로세스 정의가 없습니다. 인스턴스가 생성되면 폴러가 자동으로 수집합니다.
        </v-alert>

        <!-- 유형 상세 (인스턴스 목록) -->
        <v-dialog v-model="topicDialog" max-width="760">
            <v-card>
                <v-card-title class="text-subtitle-1">
                    {{ activeTopic?.topic_name }} · {{ activeTopic?.count }}건
                </v-card-title>
                <v-card-text style="max-height: 60vh; overflow-y: auto">
                    <v-list density="compact">
                        <v-list-item v-for="ins in topicInstances" :key="ins.proc_inst_id"
                            :title="ins.proc_inst_name || ins.proc_inst_id"
                            :subtitle="ins.request_text">
                            <template #append>
                                <span class="text-caption text-medium-emphasis">{{ fmtDate(ins.occurred_at) }}</span>
                            </template>
                        </v-list-item>
                    </v-list>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="topicDialog = false">닫기</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script>
import InstanceClassifierAPI from '@/utils/instanceClassifier';

export default {
    name: 'InstanceTopList',
    props: {
        // 지정하면 해당 프로세스 정의로 고정하고 선택기를 숨긴다(임베드용).
        procDefId: { type: String, default: null }
    },
    data() {
        return {
            procDefs: [],
            selectedDef: null,
            items: [],
            summary: null,
            loading: false,
            reclustering: false,
            topicDialog: false,
            activeTopic: null,
            topicInstances: [],
            viewMode: 'list',
            period: 'week',
            periodOptions: [
                { value: 'all', label: '전체' },
                { value: 'week', label: '주' },
                { value: 'month', label: '월' },
                { value: 'year', label: '년' }
            ]
        };
    },
    computed: {
        lockedDef() {
            return !!this.procDefId;
        },
        procDefItems() {
            return this.procDefs.map((d) => ({
                value: d.proc_def_id,
                title: `${d.proc_def_id} (${d.count}건 · 유형 ${d.topics})`
            }));
        },
        // 트리맵: 면적 = 비율(pct), 라벨 = 유형명 + 건수·비율
        treemapSeries() {
            return [{ data: this.items.map((i) => ({ x: this.shortName(i.topic_name), y: i.pct })) }];
        },
        treemapColors() {
            const blues = ['#0085db', '#2f9be0', '#54ade6', '#79c0ec', '#9fd2f2', '#c4e4f7', '#dff0fb'];
            let b = 0;
            return this.items.map((i) => (i.is_noise ? '#b0bec5' : blues[b++ % blues.length]));
        },
        treemapOptions() {
            const items = this.items;
            const fmt = this.fmtDate;
            return {
                chart: { type: 'treemap', toolbar: { show: false }, animations: { enabled: true }, fontFamily: 'inherit' },
                legend: { show: false },
                colors: this.treemapColors,
                plotOptions: { treemap: { distributed: true, enableShades: false } },
                dataLabels: {
                    enabled: true,
                    style: { fontSize: '15px', fontWeight: 600, colors: ['#ffffff'] },
                    formatter: (text, op) => {
                        const it = items[op.dataPointIndex];
                        return it ? [text, `${it.count}건 · ${it.pct}%`] : [text];
                    }
                },
                stroke: { width: 2, colors: ['rgba(255,255,255,0.6)'] },
                tooltip: {
                    custom: ({ dataPointIndex }) => {
                        const it = items[dataPointIndex];
                        if (!it) return '';
                        const kw = it.keywords
                            ? `<div style="margin-top:5px;color:#546e7a;font-size:11px;max-width:260px;white-space:normal;line-height:1.4">🏷 ${it.keywords}</div>`
                            : '';
                        const last = it.last_seen
                            ? `<div style="margin-top:4px;color:#90a4ae;font-size:11px">🕒 최근 발생 ${fmt(it.last_seen)}</div>`
                            : '';
                        return `<div style="padding:9px 12px;font-family:inherit">
                            <div style="font-weight:700;color:#263238;font-size:13px">${it.topic_name}</div>
                            <div style="margin-top:3px;color:#37474f;font-size:12px">건수 <b>${it.count}건</b> · 비율 <b>${it.pct}%</b></div>
                            ${kw}${last}</div>`;
                    }
                }
            };
        }
    },
    watch: {
        procDefId: {
            immediate: false,
            handler(v) {
                if (v) {
                    this.selectedDef = v;
                    this.loadTopList();
                }
            }
        }
    },
    async mounted() {
        if (this.procDefId) {
            this.selectedDef = this.procDefId;
            await this.loadTopList();
        } else {
            await this.loadProcDefs();
        }
    },
    methods: {
        async loadProcDefs() {
            try {
                this.procDefs = await InstanceClassifierAPI.procDefs();
                if (this.procDefs.length && !this.selectedDef) {
                    this.selectedDef = this.procDefs[0].proc_def_id;
                    await this.loadTopList();
                }
            } catch (e) {
                console.error('[InstanceTopList] proc-defs 로드 실패', e);
            }
        },
        async loadTopList() {
            if (!this.selectedDef) return;
            this.loading = true;
            try {
                const data = await InstanceClassifierAPI.topList(this.selectedDef, this.period);
                this.items = data.items || [];
                this.summary = { total: data.total, noise_ratio: data.noise_ratio };
                this.$emit('loaded', { count: this.items.length, total: data.total });
            } catch (e) {
                console.error('[InstanceTopList] toplist 로드 실패', e);
                this.items = [];
                this.summary = null;
                this.$emit('loaded', { count: 0, total: 0 });
            } finally {
                this.loading = false;
            }
        },
        async openTopic(row) {
            this.activeTopic = row;
            this.topicDialog = true;
            this.topicInstances = [];
            try {
                this.topicInstances = await InstanceClassifierAPI.topicInstances(this.selectedDef, row.topic_id, 20, this.period);
            } catch (e) {
                console.error('[InstanceTopList] topic instances 로드 실패', e);
            }
        },
        async recluster() {
            if (!this.selectedDef) return;
            this.reclustering = true;
            try {
                await InstanceClassifierAPI.recluster(this.selectedDef);
                await this.loadTopList();
            } catch (e) {
                console.error('[InstanceTopList] 재클러스터링 실패', e);
            } finally {
                this.reclustering = false;
            }
        },
        rankOf(idx) {
            // 노이즈 행을 앞에서 세지 않고 실제 순위만 매긴다.
            let rank = 0;
            for (let i = 0; i <= idx; i++) {
                if (!this.items[i].is_noise) rank++;
            }
            return rank;
        },
        fmtDate(v) {
            if (!v) return '-';
            try {
                return new Date(v).toLocaleDateString();
            } catch {
                return v;
            }
        },
        shortName(n) {
            if (!n) return '';
            return n.length > 22 ? n.slice(0, 21) + '…' : n;
        }
    }
};
</script>

<style scoped>
.gap-2 {
    gap: 8px;
}
</style>

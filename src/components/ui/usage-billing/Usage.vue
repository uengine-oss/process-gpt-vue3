<template>
    <div>
        <v-card class="pa-0" elevation="10">
            <v-tabs v-model="tab" color="primary">
                <v-tab value="Usage">
                    <GraphIcon class="mr-2" size="20"/> {{ $t('usage.tabUsage') }}
                </v-tab>
                <v-tab value="Search">
                    <SearchIcon class="mr-2" size="20"/> {{ $t('usage.tabSearch') }}
                </v-tab>
            </v-tabs>
            <v-divider></v-divider>
            <v-card-text class="pa-0 pt-4 pb-4"
                :style="!isMobile ? 'height: calc(100vh - 180px); overflow-y: auto;' : 'height: 100%; overflow-y: auto;'"
            >
                <v-window v-model="tab">
                    <v-window-item value="Usage">
                        <div>
                            <v-card flat>
                                <v-card-text class="pb-0 pt-0">
                                    <div class="text-h5 font-weight-bold mb-4">{{ $t('usage.finalCredit') }}</div>
                                    <v-card flat variant="outlined" class="pa-2">
                                        <v-card-text>
                                            <div class="d-flex justify-space-between align-center mb-1">
                                                <span class="text-body-2 text-medium-emphasis">{{ $t('usage.availableCredit') }}</span>
                                                <span class="text-h5 font-weight-bold">{{ credit ? credit.available.toFixed(2) : $t('usage.loading') }}</span>
                                            </div>
                                            <v-progress-linear
                                                :model-value="creditAvailablePercent"
                                                color="primary"
                                                height="8"
                                                rounded
                                            ></v-progress-linear>
                                            <div class="text-caption text-medium-emphasis mt-1 text-right">{{ creditAvailablePercent.toFixed(1) }}%</div>

                                            <div class="d-flex justify-space-between align-center mb-1 mt-5">
                                                <span class="text-body-2 text-medium-emphasis">{{ $t('usage.usedCredit') }}</span>
                                                <span class="text-h5 font-weight-bold">{{ credit ? credit.used.toFixed(2) : $t('usage.loading') }}</span>
                                            </div>
                                            <v-progress-linear
                                                :model-value="creditUsedPercent"
                                                color="warning"
                                                height="8"
                                                rounded
                                            ></v-progress-linear>
                                            <div class="text-caption text-medium-emphasis mt-1 text-right">{{ creditUsedPercent.toFixed(1) }}%</div>
                                        </v-card-text>
                                    </v-card>
                                </v-card-text>
                            </v-card>

                            <v-divider class="my-4"></v-divider>

                            <v-card flat>
                                <v-card-text class="pt-2 pb-0">
                                    <v-row class="ma-0 pa-0 align-center" :class="isMobile ? 'flex-column' : ''">
                                        <v-col class="pa-0" :class="isMobile ? '' : 'd-flex align-center'">
                                            <div class="text-h5 font-weight-bold">{{ $t('usage.periodUsage') }}</div>
                                            <div class="text-caption font-weight-bold" :class="isMobile ? 'mt-1' : 'ml-2'">({{ period.startAt.split(' ')[0] }} ~ {{ period.endAt.split(' ')[0] }})</div>
                                        </v-col>
                                        <v-col class="pa-0" :class="isMobile ? 'mt-3' : 'd-flex justify-end'" :style="isMobile ? '' : 'max-width: 250px;'">
                                            <v-autocomplete
                                                v-model="selectedPeriod"
                                                :items="translatedPeriodOptions"
                                                density="compact"
                                                variant="outlined"
                                                :label="$t('usage.periodSetting')"
                                                item-title="text"
                                                item-value="value"
                                                hide-details
                                            ></v-autocomplete>
                                        </v-col>
                                    </v-row>
                                </v-card-text>
                            </v-card>

                            <v-card flat>
                                <v-card-text>
                                    <div class="text-h6 font-weight-bold">{{ $t('usage.usageSummary') }}</div>
                                    <p class="text-body-2 text-medium-emphasis mt-1">{{ $t('usage.usageSummaryDescription') }}</p>

                                    <v-row class="ma-0 pa-0 mt-5 mb-5">
                                        <v-col class="pa-0">
                                            <div class="text-subtitle-1 font-weight-bold">{{ $t('usage.usageCount') }}</div>
                                            <div class="text-body-1">{{ $t('usage.countUnit', { count: summaryCredit.used_count }) }}</div>
                                        </v-col>
                                        <v-col class="pa-0">
                                            <div class="text-subtitle-1 font-weight-bold">{{ $t('usage.usedCredit') }}</div>
                                            <div class="text-body-1">{{ summaryCredit.used_credit.toFixed(2) }} 🔋</div>
                                        </v-col>
                                    </v-row>

                                    <div style="width: 100%; height: 300px;">
                                        <canvas id="summaryChart"></canvas>
                                    </div>
                                </v-card-text>
                            </v-card>

                            <v-divider></v-divider>

                            <v-card flat>
                                <v-card-text>
                                    <v-row class="ma-0 pa-0">
                                        <v-col cols="12" md="7" class="pa-0">
                                            <div class="text-h6 font-weight-bold">{{ $t('usage.serviceUsage') }}</div>
                                            <p class="text-body-2 text-medium-emphasis mt-1">{{ $t('usage.serviceUsageDescription') }}</p>

                                            <v-row class="ma-0 pa-0 mt-5">
                                                <v-data-table-virtual
                                                    :items="serviceUsage" 
                                                    :headers="translatedServiceUsageHeaders"
                                                    :no-data-text="$t('usage.noData')"
                                                >
                                                    <template v-slot:item.used_quantity="{ item }">
                                                        <v-tooltip v-if="item.used_quantity_detail">
                                                            <template v-slot:activator="{ props }">
                                                                <span v-bind="props">
                                                                    {{ item.used_quantity }}
                                                                </span>
                                                            </template>
                                                            <div>
                                                                <v-card v-for="(detail, key) in item.used_quantity_detail" :key="key" flat>
                                                                    <v-card-text>
                                                                        <div>{{ key }}</div>
                                                                        <div>{{ detail.quantity }} {{ detail.unit }}</div>
                                                                    </v-card-text>
                                                                </v-card>
                                                            </div>
                                                        </v-tooltip>
                                                        <div v-else> {{ item.used_quantity }} </div>
                                                    </template>

                                                    <template v-slot:item.name="{ item }">
                                                        <v-tooltip v-if="item.description">
                                                            <template v-slot:activator="{ props }">
                                                                <span v-bind="props">
                                                                    {{ item.name }}
                                                                </span>
                                                            </template>
                                                            <div>
                                                                {{ item.description }}
                                                            </div>
                                                        </v-tooltip>
                                                        <div v-else> {{ item.name }} </div>
                                                    </template>
                                                </v-data-table-virtual>
                                            </v-row> 
                                        </v-col>
                                        <v-col cols="12" md="5" class="pa-0">
                                            <div style="height: 400px;">
                                                <canvas id="serviceUsageChart" style="margin-left: 50px;"></canvas>
                                            </div>
                                        </v-col>
                                    </v-row>
                                </v-card-text>
                            </v-card>

                            <v-divider></v-divider>

                            <v-card flat>
                                <v-card-text>
                                    <v-row class="ma-0 pa-0">
                                        <v-col cols="12" md="7" class="pa-0">
                                            <div class="text-h6 font-weight-bold">{{ $t('usage.modelUsage') }}</div>
                                            <p class="text-body-2 text-medium-emphasis mt-1">{{ $t('usage.modelUsageDescription') }}</p>

                                            <v-row class="ma-0 pa-0 mt-5">
                                                <v-data-table-virtual
                                                    :items="modelUsage" 
                                                    :headers="translatedModelUsageHeaders"
                                                    :no-data-text="$t('usage.noData')"
                                                ></v-data-table-virtual>
                                            </v-row> 
                                        </v-col>
                                        <v-col cols="12" md="5" class="pa-0">
                                            <div style="height: 400px;">
                                                <canvas id="modelUsageChart" style="margin-left: 50px;"></canvas>
                                            </div>
                                        </v-col>
                                    </v-row>
                                </v-card-text>
                            </v-card>

                            <v-divider></v-divider>

                            <v-card flat>
                                <v-card-text>
                                    <div class="text-h6 font-weight-bold">{{ $t('usage.credit') }}</div>
                                    <p class="text-body-2 text-medium-emphasis mt-1">{{ $t('usage.creditDescription') }}</p>

                                    <v-row class="ma-0 pa-0 mt-5">
                                        <v-data-table-virtual
                                            :items="validCredit" 
                                            :headers="translatedValidCreditHeaders"
                                            :no-data-text="$t('usage.noData')"
                                        >
                                            <template v-slot:item.created_at="{ item }">
                                                {{ item.created_at.split('T')[0] }}
                                            </template>
                                            <template v-slot:item.source_type="{ item }">
                                                {{ item.source_type === 'purchase' ? $t('usage.purchase') : $t('usage.charge') }}
                                            </template>
                                            <template v-slot:item.expires_at="{ item }">
                                                {{ item.expires_at.split('T')[0] }}
                                            </template>
                                        </v-data-table-virtual>
                                    </v-row> 
                                </v-card-text>
                            </v-card>
                        </div>
                    </v-window-item>
                    <v-window-item value="Search">
                        <UsageListPage/>
                    </v-window-item>
                </v-window>
            </v-card-text>
        </v-card>
    </div>
</template>
  
<script>
import {GraphIcon, SearchIcon } from 'vue-tabler-icons';
import Chart from 'chart.js/auto'
import UsageListPage from '../list-pages/UsageListPage.vue';
import BackendFactory from '@/components/api/BackendFactory';

const backend = BackendFactory.createBackend();
export default {
    components: {
        UsageListPage
    },
    data() {
        return {
            tab: 'Usage',
            loading: true,

            selectedPeriod: 'current_month',
            selectedTenant: null,
            // 차트 인스턴스 저장용 변수들
            summaryChart: null,
            serviceUsageChart: null,
            modelUsageChart: null,
         
            credit: null,
            // 크레딧 구매 내역 
            validCredit: [],
            summaryCredit: {
                used_count: 0,
                used_credit: 0,
            },
            // 서비스 사용량
            serviceUsage: [],
            // 모델 사용량
            modelUsage: [],
        }
    },
    computed: {
        isMobile() {
            return window.innerWidth <= 768;
        },
        creditTotal() {
            if (!this.credit) return 0;
            return this.credit.available + this.credit.used;
        },
        creditAvailablePercent() {
            if (!this.creditTotal) return 0;
            return (this.credit.available / this.creditTotal) * 100;
        },
        creditUsedPercent() {
            if (!this.creditTotal) return 0;
            return (this.credit.used / this.creditTotal) * 100;
        },
        translatedPeriodOptions() {
            return [
                { text: this.$t('usage.thisMonth'), value: 'current_month' },
                { text: this.$t('usage.last7Days'), value: '7d' },
                { text: this.$t('usage.last1Month'), value: '1m' },
                { text: this.$t('usage.last3Months'), value: '3m' },
                { text: this.$t('usage.last6Months'), value: '6m' },
                { text: this.$t('usage.last1Year'), value: '1y' },
            ];
        },
        translatedValidCreditHeaders() {
            return [
                { title: this.$t('usage.date'), align: 'start', key: 'created_at' },
                { title: this.$t('usage.creditAmount'), align: 'end', key: 'added_credit' },
                { title: this.$t('usage.type'), align: 'end', key: 'source_type' },
                { title: this.$t('usage.expiryDate'), align: 'end', key: 'expires_at' },
            ];
        },
        translatedServiceUsageHeaders() {
            return [
                { title: this.$t('usage.serviceName'), align: 'start', key: 'name' },
                { title: this.$t('usage.usageCountHeader'), align: 'end', key: 'used_count' },
                { title: this.$t('usage.usageQuantity'), align: 'end', key: 'used_quantity' },
                { title: this.$t('usage.creditUsage'), align: 'end', key: 'used_credit' },
            ];
        },
        translatedModelUsageHeaders() {
            return [
                { title: this.$t('usage.modelName'), align: 'start', key: 'model' },
                { title: this.$t('usage.usageQuantity'), align: 'end', key: 'used_quantity' },
                { title: this.$t('usage.creditUsage'), align: 'end', key: 'used_credit' },
            ];
        },
        period() {
            const today = new Date();
            let startAt, endAt;

            const periodMapping = {
                'current_month': () => {
                    const start = new Date(today.getFullYear(), today.getMonth(), 1);
                    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    return [start, end];
                },
                '7d': () => {
                    const start = new Date();
                    start.setDate(today.getDate() - 7);
                    return [start, today];
                },
                '1m': () => {
                    const start = new Date();
                    start.setMonth(today.getMonth() - 1);
                    return [start, today];
                },
                '3m': () => {
                    const start = new Date();
                    start.setMonth(today.getMonth() - 3);
                    return [start, today];
                },
                '6m': () => {
                    const start = new Date();
                    start.setMonth(today.getMonth() - 6);
                    return [start, today];
                },
                '1y': () => {
                    const start = new Date();
                    start.setFullYear(today.getFullYear() - 1);
                    return [start, today];
                }
            };

            [startAt, endAt] = periodMapping[this.selectedPeriod]();

            return {
                startAt: `${startAt.toISOString().slice(0, 10).replace(/-/g, '-')} 00:00:00`,
                endAt: `${endAt.toISOString().slice(0, 10).replace(/-/g, '-')} 23:59:59`
            };
        }
    },
    watch: {
        "period": {
            handler(newVal, oldVal) {
                if(oldVal) this.init();
            },
            immediate: true
        }
    },
    mounted(){
        this.init()
    },
    methods: {
        init(){
            var me = this
            me.$try({
                action: async () => {
                    me.loading = true;
                    me.selectedTenant = window.$tenantName

                    me.currentOptions = {
                        orderBy: 'usage_start_at', 
                        startAt: me.period.startAt,
                        endAt: me.period.endAt // 종료일 23:59:59 추가
                    }
                    let usageList = await backend.getUsageWithService(me.currentOptions);

                    me.credit = await backend.getCreditBalance();
                    me.validCredit = await backend.getValidCreditPurchase(me.currentOptions);
                    
                    me.calculateDateUsage(usageList)
                    me.calculateServiceUsage(usageList)
                    me.calculateModelUsage(usageList)
                    
                    me.loading = false
                },
            });
        },
        calculateServiceUsage(usageList){
            var me = this
            me.$try({
                action: async () => {
                    const services = usageList.reduce((acc, item) => {
                        const key = item.service_id;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(item);
                        return acc;
                    }, {});

                    const usageByService = Object.entries(services).map(([service_id, items]) => {
                        // 전체 집계
                        const totalCount    = items.length;
                        const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
                        const totalCredit   = items.reduce((sum, i) => sum + i.amount, 0);

                        // 최신 레코드에서 service_name을 가져오기
                        const latestServiceName = items
                        .slice()
                        .sort((a, b) => new Date(b.usage_start_at) - new Date(a.usage_start_at))[0]
                        .service_name;

                        // service_name 별 세부 집계
                        const detailMap = items.reduce((dacc, i) => {
                        if (!dacc[i.service_name]) {
                            dacc[i.service_name] = { name: i.service_name, count: 0, quantity: 0, credit: 0 };
                        }
                        dacc[i.service_name].count    += 1;
                        dacc[i.service_name].quantity += i.quantity;
                        dacc[i.service_name].credit   += i.amount;
                        return dacc;
                        }, {});

                        const detail = Object.values(detailMap);

                        return {
                            id:       service_id,
                            name:     latestServiceName,
                            used_count:    totalCount,
                            used_quantity: totalQuantity,
                            used_credit:   totalCredit,
                            detail
                        };
                    });

                    me.serviceUsage = Object.values(usageByService).map((usage) => ({
                       ...usage,
                       used_count: me.$t('usage.countUnit', { count: usage.used_count }),
                       used_quantity: `${usage.used_quantity} token`,
                       used_credit: `${usage.used_credit.toFixed(2)} 🔋`,
                    }));

                    const totalCredit = Object.values(usageByService).reduce((sum, { used_credit }) => sum + used_credit, 0);
                    
                    // 기존 차트가 있다면 파괴
                    if (me.serviceUsageChart) {
                        me.serviceUsageChart.destroy();
                    }
                    
                    me.serviceUsageChart = new Chart(
                        document.getElementById('serviceUsageChart'),
                        {
                            type: 'doughnut',
                            data: {
                                labels: usageByService.map(s => s.name),
                                datasets: [
                                    {
                                        data: usageByService.map(s => s.used_credit / totalCredit * 100),
                                        backgroundColor: Object.keys(usageByService).map(() => `#${Math.floor(Math.random()*16777215).toString(16)}`)
                                    }
                                ],  
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                layout: {
                                    padding: {
                                        left: 0,
                                        right: 100 
                                    }
                                },
                                plugins: {
                                    legend: {
                                        position: 'right',
                                    }
                                }
                            }
                        }
                    );
                }
            })
        },
        calculateModelUsage(usageList){
            var me = this
            me.$try({
                action: async () => {
                    const usageByModel = usageList.reduce((acc, u) => {
                        const model = u.model || 'Unknown';
                        if (!acc[model]) {
                            acc[model] = { model, used_quantity: 0, used_credit: 0 };
                        }
                        acc[model].used_quantity += u.quantity || 0;
                        acc[model].used_credit += u.amount || 0;
                        return acc;
                    }, {});

                    me.modelUsage = Object.values(usageByModel).map(({ model, used_quantity, used_credit }) => ({
                        model,
                        used_quantity: `${used_quantity} token`,
                        used_credit: `${used_credit.toFixed(2)} 🔋`,
                    }));

                    const totalCredit = Object.values(usageByModel).reduce((sum, { used_credit }) => sum + used_credit, 0);
                    
                    // 기존 차트가 있다면 파괴
                    if (me.modelUsageChart) {
                        me.modelUsageChart.destroy();
                    }
                    
                    me.modelUsageChart = new Chart(
                        document.getElementById('modelUsageChart'),
                        {
                            type: 'doughnut',
                            data: {
                                labels: Object.keys(usageByModel),
                                datasets: [
                                    {
                                        data: Object.values(usageByModel).map(({ used_credit }) => (used_credit / totalCredit) * 100),
                                        backgroundColor: Object.keys(usageByModel).map(() => `#${Math.floor(Math.random()*16777215).toString(16)}`),
                                    }
                                ],  
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                layout: {
                                    padding: {
                                        left: 0,
                                        right: 100 // ← 이 값을 조절
                                    }
                                },
                                plugins: {
                                    legend: {
                                        position: 'right',
                                    }
                                }
                            }
                        }
                    );
                    
                }
            });
        },
        calculateDateUsage(usageList){
            var me = this
            me.$try({
                action: async () => {
                    // 1. 날짜 배열 생성 함수
                    function getDateRangeMMDD(start, end) {
                        const arr = [];
                        let dt = new Date(start);
                        const endDt = new Date(end);
                        while (dt <= endDt) {
                            // padStart로 항상 2자리 보장
                            const mm = String(dt.getMonth() + 1).padStart(2, '0');
                            const dd = String(dt.getDate()).padStart(2, '0');
                            arr.push(`${mm}/${dd}`);
                            dt.setDate(dt.getDate() + 1);
                        }
                        return arr;
                    }
                    const dateLabels = getDateRangeMMDD(me.period.startAt, me.period.endAt);

                    const used_count = dateLabels.map(label =>
                        usageList.filter(u => {
                            const usedDate = new Date(u['usage_start_at']);
                            const mm = String(usedDate.getMonth() + 1).padStart(2, '0');
                            const dd = String(usedDate.getDate()).padStart(2, '0');
                            return `${mm}/${dd}` === label;
                        }).length
                    );

                    const used_credit = dateLabels.map(label =>
                        usageList
                            .filter(u => {
                                const usedDate = new Date(u['usage_start_at']);
                                const mm = String(usedDate.getMonth() + 1).padStart(2, '0');
                                const dd = String(usedDate.getDate()).padStart(2, '0');
                                return `${mm}/${dd}` === label;
                            })
                            .reduce((sum, u) => sum + (u.amount || 0), 0)
                    );

                    me.summaryCredit = {
                        used_count: used_count.reduce((sum, u) => sum + u, 0),
                        used_credit: used_credit.reduce((sum, u) => sum + u, 0),
                    }
                    // 기존 차트가 있다면 파괴
                    if (me.summaryChart) {
                        me.summaryChart.destroy();
                    }

                    me.summaryChart = new Chart(
                        document.getElementById('summaryChart'),
                        {
                            type: 'bar',
                            data: {
                                datasets: [
                                    {
                                        type: 'bar',
                                        label: me.$t('usage.chartUsageCount'),
                                        data: used_count,
                                        backgroundColor: '#A0C4FF' // 파스텔 파랑
                                    }, 
                                    {
                                        type: 'line',
                                        label: me.$t('usage.chartUsageCredit'),
                                        data: used_credit,
                                        backgroundColor: '#FFD6A5' // 파스텔 오렌지 (파랑과 어울리는 색상)
                                    }
                                ],
                                labels: dateLabels
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                            }
                        }
                    );

                }
            });
        }
    }
}
</script>
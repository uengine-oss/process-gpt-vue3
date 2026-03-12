<template>
    <v-card elevation="10">
        <v-card-item>
            <div class="align-center justify-space-between">
                <div>
                    <v-row class="ma-0 pa-0 pt-2">
                        <h5 class="text-h5 mb-1 font-weight-semibold">{{ $t('ProfitExpanse.processExecutionPerformance') }}</h5>
                        <v-spacer></v-spacer>
                        <v-text-field
                            v-model="startDate"
                            :label="$t('ProfitExpanse.startDate')"
                            type="date"
                            outlined
                            style="margin-right: 10px"
                        ></v-text-field>
                        <v-text-field v-model="endDate" :label="$t('ProfitExpanse.endDate')" type="date" outlined></v-text-field>
                    </v-row>
                </div>
            </div>

            <v-row>
                <v-col cols="12" sm="9" class="pt-7">
                    <AppEChart v-if="chartOptions" class="profit-expense" :height="300" :option="chartOptions" />
                </v-col>
                <v-col cols="12" sm="3" class="mt-8 pb-6">
                    <div class="d-flex align-center gap-4 mb-3 pb-6">
                        <v-avatar style="background-color: #fff0b4">
                            <Icons :icon="'todo-list'" :color="'#FFB933'" />
                        </v-avatar>
                        <div>
                            <h5 class="text-h5 font-weight-semibold">{{ summary.todo }}</h5>
                            <h6 class="text-subtitle-1 text-grey100">{{ $t('ProfitExpanse.toDo') }}</h6>
                        </div>
                    </div>
                    <div class="d-flex align-center gap-4 mb-3 pb-6">
                        <v-avatar class="bg-lighterror">
                            <Icons :icon="'in-progress'" :color="'#FBA690'" />
                        </v-avatar>
                        <div>
                            <h5 class="text-h5 font-weight-semibold">{{ summary.inProcess }}</h5>
                            <h6 class="text-subtitle-1 text-grey100">{{ $t('ProfitExpanse.inProcess') }}</h6>
                        </div>
                    </div>
                    <div class="d-flex align-center gap-4 mb-3 pb-6">
                        <v-avatar class="bg-lightinfo">
                            <Icons :icon="'done-ring-round'" :color="'#2995DC'" />
                        </v-avatar>
                        <div>
                            <h5 class="text-h5 font-weight-semibold">{{ summary.done }}</h5>
                            <h6 class="text-subtitle-1 text-grey100">{{ $t('ProfitExpanse.done') }}</h6>
                        </div>
                    </div>
                    <div class="d-flex align-center gap-4 mb-3 pb-3">
                        <v-avatar class="bg-lightsecondary">
                            <Icons :icon="'total'" :color="'grey'" />
                        </v-avatar>
                        <div>
                            <h5 class="text-h5 font-weight-semibold">{{ summary.total }}</h5>
                            <h6 class="text-subtitle-1 text-grey100">{{ $t('ProfitExpanse.all') }}</h6>
                        </div>
                    </div>
                </v-col>
            </v-row>
        </v-card-item>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import AppEChart from '@/components/shared/AppEChart.vue';

export default {
    components: { AppEChart },
    data() {
        const now = new Date();
        // 이번달의 첫째 날
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().substr(0, 10);
        // 이번달의 마지막 날
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().substr(0, 10);

        return {
            topUsers: [],
            summary: {
                total: 0,
                inProcess: 0,
                done: 0,
                todo: 0
            },
            startDate: firstDayOfMonth,
            endDate: lastDayOfMonth,
            userStatusMap: {},
            workList: []
        };
    },
    created() {
        this.init();
    },
    watch: {
        startDate: 'initSummary',
        endDate: 'initSummary'
    },
    computed: {
        chartOptions() {
            // "완료됨" 개수에 따라 내림차순으로 정렬
            const sortedTopUsers = [...this.topUsers].sort((a, b) => b.DONE - a.DONE);

            const userNames = sortedTopUsers.map((user) => user.name);
            const todoData = sortedTopUsers.map((user) => Math.floor(user.TODO));
            const inProcessData = sortedTopUsers.map((user) => Math.floor(user.IN_PROCESS));
            const doneData = sortedTopUsers.map((user) => Math.floor(user.DONE));

            return {
                color: ['#2995DC', '#fb977d', '#FFF0B4'],
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'shadow'
                    }
                },
                grid: {
                    top: 0,
                    bottom: 12,
                    left: 20,
                    right: 20,
                    containLabel: true
                },
                legend: {
                    show: false
                },
                xAxis: {
                    type: 'category',
                    data: userNames,
                    axisLine: {
                        show: false
                    },
                    axisTick: {
                        show: false
                    },
                    axisLabel: {
                        color: 'grey'
                    }
                },
                yAxis: {
                    type: 'value',
                    axisLabel: {
                        color: 'grey'
                    },
                    splitLine: {
                        lineStyle: {
                            color: 'rgba(128, 128, 128, 0.2)'
                        }
                    }
                },
                series: [
                    {
                        name: '완료 됨',
                        type: 'bar',
                        stack: 'work',
                        barWidth: '27%',
                        emphasis: {
                            focus: 'series'
                        },
                        data: doneData
                    },
                    {
                        name: '진행 중',
                        type: 'bar',
                        stack: 'work',
                        emphasis: {
                            focus: 'series'
                        },
                        data: inProcessData
                    },
                    {
                        name: '예정업무',
                        type: 'bar',
                        stack: 'work',
                        emphasis: {
                            focus: 'series'
                        },
                        data: todoData
                    }
                ]
            };
        }
    },
    methods: {
        async init() {
            await this.getWorkList();
            this.initSummary();
        },
        async getWorkList() {
            this.userStatusMap = {};
            const backend = BackendFactory.createBackend();
            await backend.getWorkListAll().then((workList) => {
                workList.forEach((item) => {
                    this.workList.push({
                        name: item.endpoint,
                        dueDate: item.dueDate,
                        instId: item.instId,
                        status: item.status,
                        trcTag: item.trcTag
                    });
                });
            });
        },
        initSummary() {
            const start = new Date(this.startDate);
            const end = new Date(this.endDate);

            this.userStatusMap = {};

            this.workList.forEach((item) => {
                const dueDate = new Date(item.dueDate);
                if (start > dueDate || dueDate > end) {
                    //날짜 필터링
                    return;
                }

                if (!this.userStatusMap[item.name]) {
                    this.userStatusMap[item.name] = {
                        name: item.name,
                        end_dates: {
                            TODO: null,
                            IN_PROGRESS: null,
                            DONE: null
                        },
                        TODO: 0,
                        IN_PROCESS: 0,
                        DONE: 0
                    };
                }
                if (item.status === 'NEW' || item.status === 'TODO') {
                    this.userStatusMap[item.name].TODO += 1;
                    this.userStatusMap[item.name].end_dates.TODO = item.dueDate;
                } else if (item.status === 'RUNNING' || item.status === 'IN_PROGRESS') {
                    this.userStatusMap[item.name].IN_PROCESS += 1;
                    this.userStatusMap[item.name].end_dates.IN_PROGRESS = item.dueDate;
                } else if (item.status === 'COMPLETED' || item.status === 'DONE') {
                    this.userStatusMap[item.name].DONE += 1;
                    this.userStatusMap[item.name].end_dates.DONE = item.dueDate;
                }
            });

            let topUsersInfo = Object.values(this.userStatusMap);
            // DONE 상태의 end_date를 기준으로 내림차순 정렬
            topUsersInfo.sort((a, b) => new Date(b.end_dates.DONE) - new Date(a.end_dates.DONE));
            this.topUsers = topUsersInfo.slice(0, 7);
            this.summary.total = this.topUsers.reduce((acc, user) => acc + user.TODO + user.IN_PROCESS + user.DONE, 0);
            this.summary.todo = this.topUsers.reduce((acc, user) => acc + user.TODO, 0);
            this.summary.inProcess = this.topUsers.reduce((acc, user) => acc + user.IN_PROCESS, 0);
            this.summary.done = this.topUsers.reduce((acc, user) => acc + user.DONE, 0);
        }
    }
};
</script>

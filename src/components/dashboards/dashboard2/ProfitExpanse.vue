<template>
    <v-card elevation="10">
        <v-card-item>
            <div class="d-flex align-center justify-space-between">
                <div>
                    <v-row class="ma-0 pa-0">
                        <h5 class="text-h5 mb-1 font-weight-semibold">직원별 프로세스 실행실적</h5>
                        <v-spacer></v-spacer>
                        <v-text-field
                            v-model="startDate"
                            label="시작일"
                            type="date"
                            outlined
                            style="margin-right:10px;"
                        ></v-text-field>
                        <v-text-field
                            v-model="endDate"
                            label="종료일"
                            type="date"
                            outlined
                        ></v-text-field>
                    </v-row>
                </div>
            </div>

            <v-row>
                <v-col cols="12" sm="7" class="pt-7">
                    <apexchart v-if="chartOptions" type="bar" class="profit-expense" height="300" :options="chartOptions"
                        :series="chartOptions.series"> </apexchart>
                </v-col>
                <v-col cols="12" sm="5" class="mt-8 pb-6">
                    <v-card-title class="mb-3">Total</v-card-title>
                    <div class="d-flex align-center gap-4 mb-3 pb-3">
                        <v-avatar style="background-color:#FFF0B4;">
                            <Icon color="#FFB933" icon="icons8:todo-list" width="24" height="24" />
                        </v-avatar>
                        <div>
                            <h5 class="text-h5 font-weight-semibold">{{ summary.todo }}</h5>
                            <h6 class="text-subtitle-1 text-grey100">할 일</h6>
                        </div>
                    </div>
                    <div class="d-flex align-center gap-4 mb-3 pb-3">
                        <v-avatar class="bg-lighterror">
                            <Icon color="#FBA690" icon="carbon:in-progress" width="24" height="24"/>
                        </v-avatar>
                        <div>
                            <h5 class="text-h5 font-weight-semibold">{{ summary.inProcess }}</h5>
                            <h6 class="text-subtitle-1 text-grey100">진행 중</h6>
                        </div>
                    </div>
                    <div class="d-flex align-center gap-4 mb-3 pb-3">
                        <v-avatar class="bg-lightinfo">
                            <Icon color="#2995DC" icon="lets-icons:done-ring-round" width="24" height="24"/>
                        </v-avatar>
                        <div>
                            <h5 class="text-h5 font-weight-semibold">{{ summary.done }}</h5>
                            <h6 class="text-subtitle-1 text-grey100">완료 됨</h6>
                        </div>
                    </div>
                    <div class="d-flex align-center gap-4  mb-3 pb-3">
                        <v-avatar class=" bg-lightsecondary">
                            <Icon color="grey" icon="fluent-mdl2:total" width="24" height="24" />
                        </v-avatar>
                        <div>
                            <h5 class="text-h5 font-weight-semibold">{{ summary.total }}</h5>
                            <h6 class="text-subtitle-1 text-grey100">전체</h6>
                        </div>
                    </div>
                </v-col>
            </v-row>
        </v-card-item>
    </v-card>
</template>

<script>
import StorageBaseFactory from '@/utils/StorageBaseFactory';

export default {
    components: {
    },
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
                todo: 0,
            },
            startDate: firstDayOfMonth,
            endDate: lastDayOfMonth,
        };
    },
    created() {
        this.init();
    },
    watch: {
        startDate: 'init',
        endDate: 'init'
    },
    computed: {
        chartOptions() {
            // "완료됨" 개수에 따라 내림차순으로 정렬
            const sortedTopUsers = [...this.topUsers].sort((a, b) => b.DONE - a.DONE);

            const userNames = sortedTopUsers.map(user => user.name);
            const todoData = sortedTopUsers.map(user => Math.floor(user.TODO));
            const inProcessData = sortedTopUsers.map(user => Math.floor(user.IN_PROCESS));
            const doneData = sortedTopUsers.map(user => Math.floor(user.DONE));

            return {
                series: [
                    {
                        name: "완료 됨",
                        data: doneData,
                    },
                    {
                        name: "진행 중",
                        data: inProcessData,
                    },
                    {
                        name: "할 일",
                        data: todoData,
                    },
                ],
                //  #2995DC(완료 됨), #fb977d(진행 중), ##FFF0B4(할 일)
                colors: [ "#2995DC", "#fb977d", "#FFF0B4"],
                chart: {
                    type: "bar",
                    fontFamily: `inherit`,
                    foreColor: "#adb0bb",
                    width: "100%",
                    height: 300,
                    stacked: true,
                    toolbar: {
                        show: false,
                    },
                },
                plotOptions: {
                    bar: {
                        horizontal: false,
                        columnWidth: "27%",
                        borderRadius: 6,
                    },
                },
                dataLabels: {
                    enabled: false,
                },
                grid: {
                    borderColor: 'grey',
                    padding: { top: 0, bottom: -8, left: 20, right: 20 },
                },
                xaxis: {
                    categories: userNames,
                    axisBorder: {
                        show: false,
                    },
                    axisTicks: {
                        show: false,
                    },
                    labels: {
                        style: {
                            colors: 'grey',
                        }
                    },
                },
                yaxis: {
                    labels: {
                        style: {
                            colors: 'grey',
                        }
                    },
                },
                legend: {
                    show: false,
                },
            };
        }
    },
    methods: {
        init() {
            var me = this;
            const storage = StorageBaseFactory.getStorage();
            storage?.list('todolist').then(todoList => {
                storage?.list('users').then(users => {
                    const userStatusMap = {};
                    users.forEach(user => {
                        todoList.forEach(item => {
                            const itemEndDate = new Date(item.end_date);
                            const start = new Date(me.startDate);
                            const end = new Date(me.endDate);
                            if (user.email === item.user_id && itemEndDate >= start && itemEndDate <= end) {
                                if (!userStatusMap[user.email]) {
                                    userStatusMap[user.email] = {
                                        name: user.username,
                                        end_dates: {
                                            TODO: null,
                                            IN_PROGRESS: null,
                                            DONE: null
                                        },
                                        TODO: 0,
                                        IN_PROCESS: 0,
                                        DONE: 0,
                                    };
                                }
                                if (item.status === 'TODO') {
                                    userStatusMap[user.email].TODO += 1;
                                    userStatusMap[user.email].end_dates.TODO = item.end_date;
                                } else if (item.status === 'IN_PROGRESS') {
                                    userStatusMap[user.email].IN_PROCESS += 1;
                                    userStatusMap[user.email].end_dates.IN_PROGRESS = item.end_date;
                                } else if (item.status === 'DONE') {
                                    userStatusMap[user.email].DONE += 1;
                                    userStatusMap[user.email].end_dates.DONE = item.end_date;
                                }
                            }
                        });
                    });

                    let topUsersInfo = Object.values(userStatusMap);
                    // DONE 상태의 end_date를 기준으로 내림차순 정렬
                    topUsersInfo.sort((a, b) => new Date(b.end_dates.DONE) - new Date(a.end_dates.DONE));
                    me.topUsers = topUsersInfo.slice(0, 7);
                    me.summary.total = me.topUsers.reduce((acc, user) => acc + user.TODO + user.IN_PROCESS + user.DONE, 0);
                    me.summary.todo = me.topUsers.reduce((acc, user) => acc + user.TODO, 0);
                    me.summary.inProcess = me.topUsers.reduce((acc, user) => acc + user.IN_PROCESS, 0);
                    me.summary.done = me.topUsers.reduce((acc, user) => acc + user.DONE, 0);
                });
            });
        },
    },
};
</script>

<style type="text/css">
.profit-expense .apexcharts-bar-series.apexcharts-plot-series .apexcharts-series path {
    clip-path: inset(0 0 5% 0 round 20px);
}
</style>
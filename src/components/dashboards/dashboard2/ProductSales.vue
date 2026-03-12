<script setup lang="ts">
import { ref } from 'vue';
import { computed } from 'vue';
import { getPrimary, getLightborder } from '@/utils/UpdateColors';
import AppEChart from '@/components/shared/AppEChart.vue';
import { DotsVerticalIcon } from 'vue-tabler-icons';
const items = ref([{ title: 'Action' }, { title: 'Another action' }, { title: 'Something else here' }]);

/* Chart */
const chartOptions = computed(() => {
    return {
        color: [getPrimary.value],
        tooltip: {
            trigger: 'axis'
        },
        grid: {
            top: 16,
            right: 0,
            bottom: 0,
            left: 0,
            containLabel: true,
            borderColor: getLightborder.value
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: ['2016', '2017', '2018', '2019', '2020', '2021', '2022'],
            axisLine: {
                show: false
            },
            axisTick: {
                show: false
            }
        },
        yAxis: {
            type: 'value',
            splitLine: {
                lineStyle: {
                    color: getLightborder.value,
                    type: 'dashed'
                }
            }
        },
        axisPointer: {
            lineStyle: {
                color: getPrimary.value
            }
        },
        series: [
            {
                name: 'Test Results',
                type: 'line',
                smooth: true,
                showSymbol: false,
                lineStyle: {
                    width: 2
                },
                areaStyle: {
                    opacity: 0.18
                },
                data: [13, 15, 14, 17, 16, 19, 17]
            }
        ]
    };
});
</script>
<template>
    <v-card elevation="10">
        <v-card-item>
            <div class="d-flex align-center justify-space-between">
                <div>
                    <h5 class="text-h5 mb-1 font-weight-semibold">Product Sales</h5>
                </div>
                <div>
                    <v-menu bottom left>
                        <template v-slot:activator="{ props }">
                            <v-btn icon color="inherit" v-bind="props" flat>
                                <DotsVerticalIcon stroke-width="1.5" size="24" class="text-grey100" />
                            </v-btn>
                        </template>
                        <v-list density="compact">
                            <v-list-item v-for="(item, i) in items" :key="i" :value="i">
                                <v-list-item-title>{{ item.title }}</v-list-item-title>
                            </v-list-item>
                        </v-list>
                    </v-menu>
                </div>
            </div>
            <div>
                <AppEChart :option="chartOptions" :height="240" />
                <div class="d-flex align-center mt-2 gap-4">
                    <div class="d-flex align-center">
                        <v-avatar class="bg-lightprimary me-4">
                            <Icons :icon="'user-circle-linear'" class="text-primary" />
                        </v-avatar>
                        <div>
                            <h6 class="text-h6 font-weight-semibold d-flex align-center">
                                36,436 <v-chip color="success" class="bg-lightsuccess ml-1" variant="outlined" size="x-small">+12%</v-chip>
                            </h6>
                            <p class="text-subtitle-1 text-grey100 font-weight-medium">New Customer</p>
                        </div>
                    </div>
                </div>
            </div>
        </v-card-item>
    </v-card>
</template>

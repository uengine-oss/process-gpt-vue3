<script setup lang="ts">
import { ref } from 'vue';
import { computed } from 'vue';
import { getPrimary, getLight100, getWarning, getError } from '@/utils/UpdateColors';
import AppEChart from '@/components/shared/AppEChart.vue';
import { CircleIcon, DotsVerticalIcon } from 'vue-tabler-icons';
const items = ref([{ title: 'Action' }, { title: 'Another action' }, { title: 'Something else here' }]);

/* Chart */
const chartOptions = computed(() => {
    const series = [5368, 3319, 3500, 4106];
    const labels = ['5368', 'Direct Traffic', 'Refferal Traffic', 'Oragnic Traffic'];

    return {
        color: [getLight100.value, getWarning.value, getError.value, getPrimary.value],
        tooltip: {
            trigger: 'item'
        },
        legend: {
            show: false
        },
        series: [
            {
                type: 'pie',
                radius: ['55%', '75%'],
                center: ['42%', '50%'],
                avoidLabelOverlap: true,
                label: {
                    show: false
                },
                labelLine: {
                    show: false
                },
                data: labels.map((label, index) => ({
                    value: series[index],
                    name: label
                }))
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
                    <h5 class="text-h5 mb-1 font-weight-semibold">Traffic Distribution</h5>
                </div>
                <div>
                    <v-menu bottom left>
                        <template v-slot:activator="{ props }">
                            <v-btn icon v-bind="props" flat>
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

            <v-row class="d-sm-flex align-center mt-sm-8 mt-5">
                <v-col cols="12" lg="7" md="5">
                    <AppEChart :option="chartOptions" :height="280" />
                </v-col>
                <v-col cols="12" lg="5" md="7">
                    <div class="d-flex mb-6 pb-3">
                        <CircleIcon stroke-width="1.5" size="18" class="text-primary" />
                        <div class="ml-2 mt-n1">
                            <h5 class="text-h5 d-flex font-weight-semibold">
                                4,106<span class="text-subtitle-2 text-success ml-1 pt-2">+23%</span>
                            </h5>
                            <h6 class="text-subtitle-1 text-grey100">Oragnic Traffic</h6>
                        </div>
                    </div>
                    <div class="d-flex mb-6 pb-3">
                        <CircleIcon stroke-width="1.5" size="18" class="text-error" />
                        <div class="ml-2 mt-n1">
                            <h5 class="text-h5 font-weight-semibold">3,500</h5>
                            <h6 class="text-subtitle-1 text-grey100">Refferal Traffic</h6>
                        </div>
                    </div>
                    <div class="d-flex">
                        <CircleIcon stroke-width="1.5" size="18" class="text-warning" />
                        <div class="ml-2 mt-n1">
                            <h5 class="text-h5 font-weight-semibold">3,319</h5>
                            <h6 class="text-subtitle-1 text-grey100">Direct Traffic</h6>
                        </div>
                    </div>
                </v-col>
            </v-row>
        </v-card-item>
    </v-card>
</template>

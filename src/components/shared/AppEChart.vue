<template>
    <VChart class="app-echart" :class="chartClass" :option="option" :autoresize="true" :style="chartStyle" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, CandlestickChart, LineChart, PieChart, RadarChart } from 'echarts/charts';
import { DatasetComponent, GridComponent, LegendComponent, TitleComponent, TooltipComponent, TransformComponent } from 'echarts/components';

use([
    CanvasRenderer,
    BarChart,
    CandlestickChart,
    LineChart,
    PieChart,
    RadarChart,
    DatasetComponent,
    GridComponent,
    LegendComponent,
    TitleComponent,
    TooltipComponent,
    TransformComponent
]);

const props = defineProps({
    option: {
        type: Object,
        required: true
    },
    height: {
        type: [Number, String],
        default: 300
    },
    chartClass: {
        type: String,
        default: ''
    }
});

const chartStyle = computed(() => ({
    height: typeof props.height === 'number' ? `${props.height}px` : props.height,
    width: '100%'
}));
</script>

<style scoped>
.app-echart {
    min-width: 0;
}
</style>

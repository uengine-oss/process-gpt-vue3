<template>
    <div>
        <g-gantt-chart :chart-start="chartStartDate" :chart-end="chartEndDate" precision="month" 
            bar-start="startDate" bar-end="endDate" push-on-overlap color-scheme="sky" @dragend-bar="onDragEnd">
            <g-gantt-row v-for="(item, index) in workItems" :key="index" :bars="[item]" />
        </g-gantt-chart>
    </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue';
import { format } from 'date-fns';
import BackendFactory from '@/components/api/BackendFactory';

export default {
    props: {
        instance: Object,
    },
    setup(props) {
        const workItems = ref([]);
        const backend = BackendFactory.createBackend();
        const chartStartDate = ref('');
        const chartEndDate = ref('');

        const getRandomColor = () => {
            const letters = '0123456789ABCDEF';
            let color = '#';
            for (let i = 0; i < 6; i++) {
                color += letters[Math.floor(Math.random() * 16)];
            }
            return color;
        };

        const getContrastColor = (hexColor) => {
            const r = parseInt(hexColor.slice(1, 3), 16);
            const g = parseInt(hexColor.slice(3, 5), 16);
            const b = parseInt(hexColor.slice(5, 7), 16);
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            return luminance > 0.5 ? 'black' : 'white';
        };

        const init = async () => {
            if (props.instance && props.instance.instanceId) {
                const items = await backend.getWorkListByInstId(props.instance.instanceId);
                if (items && items.length > 0) {
                    let earliestStart = new Date(items[0].startDate);
                    let latestEnd = new Date(items[0].dueDate || items[0].startDate);

                    items.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

                    workItems.value = items.map(item => {
                        const startDate = new Date(item.startDate);
                        const endDate = new Date(item.dueDate || item.startDate);

                        if (startDate < earliestStart) earliestStart = startDate;
                        if (endDate > latestEnd) latestEnd = endDate;

                        const backgroundColor = getRandomColor();
                        const textColor = getContrastColor(backgroundColor);

                        return {
                            startDate: startDate,
                            endDate: endDate,
                            ganttBarConfig: {
                                id: item.taskId,
                                label: item.title,
                                hasHandles: true,
                                style: {
                                    background: backgroundColor,
                                    borderRadius: "20px",
                                    color: textColor,
                                    minWidth: "50px",
                                    cursor: "pointer",
                                }
                            }                            
                        };
                    });

                    const oneMonthInMs = 15 * 24 * 60 * 60 * 1000;
                    earliestStart = new Date(earliestStart.getTime() - oneMonthInMs);
                    latestEnd = new Date(latestEnd.getTime() + oneMonthInMs);
                    chartStartDate.value = format(earliestStart, 'yyyy-MM-dd HH:mm');
                    chartEndDate.value = format(latestEnd, 'yyyy-MM-dd HH:mm');
                }
            }
        };

        const onDragEnd = async (event) => {
            const { bar } = event;
            const { id } = bar.ganttBarConfig;
            const { startDate, endDate } = bar;

            const updatedItem = workItems.value.find(item => item.ganttBarConfig.id === id);
            
            if (updatedItem) {
                updatedItem.startDate = new Date(startDate);
                updatedItem.endDate = new Date(endDate);

                try {
                    const updatedTask = {
                        id: id,
                        title: updatedItem.ganttBarConfig.label,
                        startDate: updatedItem.startDate,
                        dueDate: updatedItem.endDate,
                    }
                    await backend.putWorklist(id, updatedTask);
                } catch (error) {
                    console.error('Failed to update work item dates:', error);
                }
            }
        };
    
        onMounted(init);
    
        watch(() => props.instance.instanceId, async (newVal, oldVal) => {
            if (newVal !== oldVal) {
                await init();
            }
        }, { deep: true });
    
        return {
            workItems,
            chartStartDate,
            chartEndDate,
            onDragEnd,
        };
    }
};
</script>

<style>
.g-upper-timeunit {
    font-size: 20px;
    font-weight: 500;
}

.g-timeunit {
    font-size: 16px;
    font-weight: 500;
}
</style>


<template>
    <v-card class="pa-4" height="calc(100vh - 134px)" style="overflow-y: auto">
        <div class="d-flex justify-between align-center mb-4">
            <h3 class="text-lg font-bold">등록된 스케줄 ({{ schedules.length }}건)</h3>
        </div>

        <v-list lines="three">
            <v-list-item v-for="(schedule, idx) in schedules" :key="idx" class="mb-2 border-b pb-2">
                <v-list-item-title class="font-bold mb-1"> 🏷️ {{ schedule.jobname }} </v-list-item-title>

                <v-list-item-subtitle class="text-sm text-gray-700"> ⏰ Cron: {{ schedule.schedule }} </v-list-item-subtitle>

                <v-list-item-subtitle class="text-sm text-gray-700"> 📌 Command: {{ schedule.command.trim() }} </v-list-item-subtitle>

                <v-list-item-subtitle class="text-sm text-gray-700">
                    🔗 Host: {{ schedule.nodename }}:{{ schedule.nodeport }}
                </v-list-item-subtitle>

                <v-list-item-subtitle class="text-sm text-gray-700">
                    🗂️ DB: {{ schedule.database }} | 👤 {{ schedule.username }}
                </v-list-item-subtitle>

                <v-list-item-subtitle class="text-sm text-gray-700"> ✅ Active: {{ schedule.active }} </v-list-item-subtitle>

                <div class="d-flex justify-end gap-2 mt-2">
                    <v-btn icon size="small" @click="onClickDelete(schedule)"><v-icon>mdi-delete</v-icon></v-btn>
                </div>

                <v-divider class="my-2" />
            </v-list-item>
        </v-list>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    name: 'ScheduleList',
    data() {
        return {
            schedules: []
        };
    },
    async created() {
        await this.loadSchedules();
    },
    methods: {
        async loadSchedules() {
            try {
                const result = await backend.getSchedule();
                this.schedules = result || [];
            } catch (e) {
                console.error('스케줄 불러오기 실패:', e);
            }
        },

        formatDatetime(dateStr) {
            if (!dateStr) return '-';
            const d = new Date(dateStr);
            return d.toLocaleString('ko-KR');
        },

        getLabelForKey(key) {
            const map = {
                target: '알림 대상',
                message: '알림 메시지',
                processId: '프로세스',
                reportType: '보고서 유형'
            };
            return map[key] || key;
        },

        getValueForKey(key, val) {
            const valueMap = {
                customers: '고객',
                'loan-monitoring': '대출 모니터링',
                'monthly-performance': '월간 실적 보고서'
            };
            return valueMap[val] || val;
        },
        async onClickDelete(schedule) {
            try {
                if (!schedule?.jobid) return;
                await backend.deleteSchedule(schedule);
                this.schedules = this.schedules.filter((s) => s.jobid !== schedule.jobid);
            } catch (e) {
                console.error('삭제 실패:', e);
            }
        }
    }
};
</script>

<style scoped>
.v-list-item {
    align-items: flex-start;
}
</style>

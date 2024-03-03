<template>
    <v-card elevation="10" style="height:100%;">
        <v-card-text style="padding:20px 20px 0px 20px">
            <div class="d-flex align-center justify-space-between">
                <h5 class="text-h5 mb-1 font-weight-semibold">{{ $t('DashboardUpcomingScheduls.title') }}</h5>
                <v-btn @click="goToCalendar()"
                    icon
                >
                    <Icon icon="material-symbols:tab-move" width="24" height="24" />
                </v-btn>
            </div>
        </v-card-text>
        <v-table class="mt-0 mb-0 pa-5" style="padding-top:0px !important;">
            <template v-slot:default>
                <thead>
                    <tr>
                        <th class="text-subtitle-1 font-weight-semibold text-grey200 text-no-wrap">{{ $t('DashboardUpcomingScheduls.schedule') }}</th>
                        <th class="text-subtitle-1 font-weight-semibold text-grey200 text-no-wrap">{{ $t('DashboardUpcomingScheduls.dateAndTime') }}</th>
                        <th class="text-subtitle-1 font-weight-semibold text-grey200 text-no-wrap">{{ $t('DashboardUpcomingScheduls.category') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(calendar, index) in calendars" :key="index"
                        class="month-item"
                    >
                        <td>
                            <h5 class="text-subtitle-1  font-weight-medium text-no-wrap text-grey100">
                                {{ calendar.title }}
                            </h5>
                        </td>
                        <td>
                            <h5 class="text-subtitle-1  font-weight-medium text-no-wrap text-grey100">
                                {{ formatDateTime(calendar.start) }}
                            </h5>
                        </td>
                        <td>
                            <div style="width:16px; height:16px; border-radius: 50%;" :style="{ backgroundColor: calendar.color }"></div>
                        </td>
                    </tr>
                </tbody>
            </template>
        </v-table>
    </v-card>
</template>
<script>
import StorageBaseFactory from '@/utils/StorageBaseFactory';

export default {
    data() {
        return {
            calendars: [],
        }
    },
    async created() {
        const storage = await StorageBaseFactory.getStorage();
        const calendarsData = await storage?.getObject('calendar/data');
        const userInfo = await storage?.getUserInfo();

        // userInfo.uid와 일치하는 uid를 가진 calendarData만 필터링
        const userCalendarData = calendarsData.filter(calendar => calendar.uid === userInfo.uid);

        let calendars = [];
        if (userCalendarData.length > 0) {
            // 가정: 하나의 유저에 대한 데이터만 취급. 첫 번째 일치하는 데이터 사용
            const calendarData = userCalendarData[0].data;
            const firstKey = Object.keys(calendarData)[0];
            calendars = Object.values(calendarData[firstKey]);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0); // 시간 정보 초기화

        calendars = calendars
            .filter(calendar => {
                const calendarDate = new Date(calendar.start);
                return calendarDate >= today; // 오늘 날짜 이후인 일정만 필터링
            })
            .sort((a, b) => {
                const dateA = new Date(a.start), dateB = new Date(b.start);
                return dateA - dateB; // 날짜 순으로 정렬
            })
            .slice(0, 7); // 결과 배열에서 처음 7개의 요소만 가져옵니다.

        this.calendars = calendars;
    },
    methods: {
        goToCalendar() {
            this.$router.push('/apps/calendar');
        },
        formatDateTime(datetime) {
            if (!datetime) return '';
            const [datePart, timePart] = datetime.split('T');
            const date = new Date(datetime);
            if (!timePart) {
                return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
            }
            const options = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false };
            return new Intl.DateTimeFormat('ko-KR', options).format(date);
        }
    }
};
</script>


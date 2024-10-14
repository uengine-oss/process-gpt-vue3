<template>
    <div>
        <v-card elevation="10" style="height:83vh" class="pa-4">
            <v-row class="ma-0 pa-0 pt-2 pt-b2 delete-input-details">
                <v-card-title>{{ $t('admin.instanceList') }}</v-card-title>
                <div class="d-flex align-center flex-fill border border-borderColor header-search rounded-pill px-5 ">
                    <Icons :icon="'magnifer-linear'" :size="22" />
                    <v-text-field
                        v-model="filters.name"
                        label="이름"
                        variant="plain"
                        density="compact"
                        class="position-relative pt-0 ml-3 custom-placeholer-color admin-filter-font-size"
                        placeholder="이름"
                        single-line
                        hide-details
                        style="max-width: 100px;"
                    ></v-text-field>
                </div>
                <div class="d-flex align-center flex-fill border border-borderColor header-search rounded-pill px-5 ml-4">
                    <Icons :icon="'magnifer-linear'" :size="22" />
                    <v-text-field
                        v-model="filters.initEp"
                        label="요청자"
                        variant="plain"
                        density="compact"
                        class="position-relative pt-0 ml-3 custom-placeholer-color admin-filter-font-size"
                        placeholder="요청자"
                        single-line
                        hide-details
                    ></v-text-field>
                </div>
            </v-row>
            <v-row class="ma-0 pa-0 pt-2 pt-b2 delete-input-details">
                <v-select
                    v-model="filters.subProcess"
                    :items="subProcessOptions"
                    label="서브 프로세스"
                    variant="underlined"
                    class="ml-3"
                    style="max-width: 160px;"
                    :menu-props="{ closeOnContentClick: false }"
                    :append-icon="filters.subProcess ? 'mdi-close' : ''"
                    @click:append="clearSubProcess"
                ></v-select>

                <v-select
                    v-model="filters.status"
                    :items="statusOptions"
                    label="상태"
                    variant="underlined"
                    class="ml-3"
                    style="max-width: 160px;"
                    :menu-props="{ closeOnContentClick: false }"
                    :append-icon="filters.status ? 'mdi-close' : ''"
                    @click:append="clearStatus"
                ></v-select>
                
                <v-text-field
                    @click="toggleStartDateMenu"
                    v-model="formattedStartDate"
                    label="시작일"
                    readonly
                    class="ml-3 no-border admin-calendar-label"
                    prepend-inner-icon="mdi-calendar"
                    :append-icon="filters.startedDate ? 'mdi-close' : ''"
                    @click:append="clearStartDate($event)"
                ></v-text-field>

                <v-list
                    v-if="startDateMenu"
                    class="elevation-1"
                    style="position: absolute;
                    z-index: 10; 
                    margin:45px 0px 0px 215px;"
                >
                    <v-list-item>
                        <div style="display: flex; justify-content: flex-end;">
                            <v-btn icon variant="text" density="comfortable" @click="startDateMenu = false">
                                <v-icon>mdi-close</v-icon>
                            </v-btn>
                        </div>
                        <v-date-picker
                            v-model="filters.startedDate"
                            @update:model-value="startDateMenu = !startDateMenu"
                        ></v-date-picker>
                    </v-list-item>
                </v-list>

                <v-text-field
                    @click="toggleFinishedDateMenu"
                    v-model="formattedFinishedDate"
                    label="종료일"
                    readonly
                    class="ml-3 no-border admin-calendar-label"
                    prepend-inner-icon="mdi-calendar"
                    :append-icon="filters.finishedDate ? 'mdi-close' : ''"
                    @click:append="clearFinishedDate($event)"
                ></v-text-field>

                <v-list
                    v-if="finishedDateMenu"
                    class="elevation-1"
                    style="position: absolute;
                    z-index: 10; 
                    margin:45px 0px 0px 415px;"
                >
                    <v-list-item>
                        <div style="display: flex; justify-content: flex-end;">
                            <v-btn icon variant="text" density="comfortable" @click="finishedDateMenu = false">
                                <v-icon>mdi-close</v-icon>
                            </v-btn>
                        </div>
                        <v-date-picker
                            v-model="filters.finishedDate"
                            @update:model-value="finishedDateMenu = !finishedDateMenu"
                        ></v-date-picker>
                    </v-list-item>
                </v-list>
                
                <v-btn @click="getFilteredInstanceList(0)"
                    class="ml-4 mt-2"
                    rounded
                    color="primary"
                >검색</v-btn>
            </v-row>
            
            <v-data-table
                v-model:search="search"
                :items="instanceList"
                :headers="headers"
                :items-per-page="10"
                style="height:calc(100% - 100px); overflow: auto;"
                no-data-text="검색 결과가 없습니다."
            >
                <template v-slot:item.name="{ item }">
                    <div>{{ item.instName }}</div>
                </template>
                <template v-slot:item.status="{ item }">
                    <div>
                        <v-chip v-if="item.status == 'Completed'" color="success">
                            {{ item.status }}
                        </v-chip>
                        <v-chip v-if="item.status == 'Running'" color="primary">
                            {{ item.status }}
                        </v-chip>
                        <v-chip v-if="item.status == 'Pending' || item.status == 'Stopped'">
                            {{ item.status }}
                        </v-chip>
                        <v-chip v-if="item.status == 'Failed'" color="error">
                            {{ item.status }}
                        </v-chip>
                    </div>
                </template>
                <template v-slot:item.actions="{ item }">
                    <v-tooltip :text="$t('admin.viewDetails')">
                        <template v-slot:activator="{ props }">
                            <v-btn @click="viewDetail(item)"
                                v-bind="props"
                                icon variant="text"
                                density="comfortable"
                            >
                                <Icons :icon="'preview'" :size="18" class="text-primary"/>
                            </v-btn>
                        </template>
                    </v-tooltip>
                </template>
                <template v-slot:item.initEp="{ item }">
                    <div>{{ item.initEp }}</div>
                </template>
                <template v-slot:item.subProcess="{ item }">
                    <v-icon v-if="item.subProcess" color="success">mdi-checkbox-marked-circle</v-icon>
                </template>
                <template v-slot:item.startedDate="{ item }">
                    <div>{{ formatDate(item.startedDate) }}</div>
                </template>
                <template v-slot:item.finishedDate="{ item }">
                    <div>{{ formatDate(item.finishedDate) }}</div>
                </template>
            </v-data-table>
        </v-card>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

import { VDataTable } from 'vuetify/components/VDataTable';

export default {
    name: 'admin',
    components: {
        VDataTable
    },
    data: () => ({
        instanceList: [],
        search: '',
        headers: [],
        filters: {
            instName: null,
            status: null,
            startedDate: null,
            finishedDate: null,
            initEp: null,
            subProcess: null,
            date: null,
        },
        startDateMenu: false,
        finishedDateMenu: false,
        statusOptions: ['Running', 'Completed'],
        subProcessOptions: ['true', 'false']
    }),
    async created() {
        this.getFilteredInstanceList(0);
    },
    mounted() {
        this.headers = [
            {
                align: 'start',
                key: 'instId',
                sortable: false,
                title: this.$t('admin.instanceId')
            },
            { key: 'name', align: 'start', title: this.$t('admin.name') },
            { key: 'status', align: 'start', title: this.$t('admin.status') },
            { key: 'startedDate', align: 'start', title: this.$t('admin.startedDate') },
            { key: 'finishedDate', align: 'start', title: this.$t('admin.finishedDate') },
            { key: 'initEp', align: 'start', title: this.$t('admin.initiator') },
            { key: 'subProcess', align: 'center', title: this.$t('admin.subProcess') },
            { key: 'actions', align: 'start', title: this.$t('admin.actions') }
        ]
    },
    computed: {
        formattedStartDate() {
            if (!this.filters.startedDate) return '';
            const date = new Date(this.filters.startedDate);
            date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); // 로컬 타임존 보정
            return date.toISOString().split('T')[0];  // YYYY-MM-DD 형식
        },
        formattedFinishedDate() {
            if (!this.filters.finishedDate) return '';
            const date = new Date(this.filters.finishedDate);
            date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); // 로컬 타임존 보정
            return date.toISOString().split('T')[0];  // YYYY-MM-DD 형식
        },
    },
    methods: {
        clearStatus() {
            this.filters.status = null;
        },
        clearSubProcess() {
            this.filters.subProcess = null;
        },
        toggleStartDateMenu() {
            this.finishedDateMenu = false; // 종료일 메뉴 닫기
            this.startDateMenu = !this.startDateMenu; // 시작일 메뉴 토글
        },
        toggleFinishedDateMenu() {
            this.startDateMenu = false; // 시작일 메뉴 닫기
            this.finishedDateMenu = !this.finishedDateMenu; // 종료일 메뉴 토글
        },
        clearStartDate(event) {
            event.stopPropagation(); // 이벤트 전파 중지
            this.filters.startedDate = null;
        },
        clearFinishedDate(event) {
            event.stopPropagation(); // 이벤트 전파 중지
            this.filters.finishedDate = null;
        },
        formatDate(date) {
            if (!date) return 'N/A';  // 날짜가 없을 경우 'N/A' 표시
            const options = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric' };
            return new Date(date).toLocaleString('ko-KR', options);
        },
        viewDetail(item) {
            this.$router.push({ name: 'Admin Detail', params: { id: item.instId } });
        },
        async getFilteredInstanceList(page) {
            let me = this;
            const filters = {
                ...me.filters,
                startedDate: me.formattedStartDate,
                finishedDate: me.formattedFinishedDate
            };
            console.log('Filters:', filters);  // 콘솔 로그 추가
            await backend.getFilteredInstanceList(filters, page).then((response) => {
                console.log(response);
                let result = [];
                response.forEach((item) => {
                    result.push(item);
                });
                me.instanceList = result;
            });
        }
    }
};
</script>

<style>
.admin-filter-font-size .v-field-label {
    font-size:13px !important;
}

.admin-calendar-label {
    max-width:175px;
}

.admin-calendar-label input {
    padding-right:0px !important;
    max-width:175px;
}

.admin-calendar-label .v-input__append {
    margin-inline-start: 0 !important;
}
</style>

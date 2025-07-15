<template>
    <ListPage
        v-if="initLoading"
        :items="filteredList"
        :title="title"
        :loading="loading"
        :config="config"
        :searchConfig="searchConfig"
        :filterConfig="filterConfig"
        :filter="filter"
        @filter="handleFilter"
        @search="handleSearch"
        @load="handleLoad"
    >
        <template v-slot:item-row="{ item }">
            <v-card @click="handleRowClick(item)" class="completed-instances-style">
                <v-card-title class="pt-4">
                    <StatusChip :status="item.status" type="instance"/>
                    <strong style="margin-left: 5px;">{{ item.name }}</strong>
                </v-card-title>
                <v-card-text style="padding: 0 16px 16px !important;">
                    <div>ID: {{ item.instId }}</div>
                    <div>{{ $t('filterConfigLabel.startDate') }}: {{ formatDateTime(item.startDate) }}</div>
                    <div>{{ $t('filterConfigLabel.endDate') }}: {{ formatDateTime(item.endDate) }}</div>
                    <div>{{ $t('filterConfigLabel.dueDate') }}: {{ formatDateTime(item.dueDate) }}</div>
                </v-card-text>
            </v-card>
        </template>
    </ListPage>
  </template>
  
<script>
import ListPage from '@/components/ui/common/ListPage.vue'
import StatusChip from '@/components/ui/common/StatusChip.vue'

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: { ListPage, StatusChip },
    props: {
      // 리스트 타입: '*', 'COMPLETED', 'NEW' ...
      listType: {
        type: Array,
        default: ['*']
      },
      title: {
        type: String,
        default: '모든 인스턴스'
      },
      searchConfig: {
        type: Object,
        default: {
            show: true,
            label: '인스턴스 검색',
        }
      },
      // 기본 설정 관련 설정
      config: {
        type: Object,
        default: {
            height: 700,
            itemsPerPage: 1
        }
      }
    },
    data() {
        return {
            loading: true,
            list: [],
            filterConfig: {
                sort: {
                    label: this.$t('filterConfigLabel.sort'),
                    options: [
                        { text: this.$t('filterConfigOptions.latest'), value: 'updated_at' }, // desc
                        { text: this.$t('filterConfigOptions.startDate'), value: 'start_date' }, // asc
                        { text: this.$t('filterConfigOptions.endDate'), value: 'end_date' }, // desc
                        { text: this.$t('filterConfigOptions.dueDate'), value: 'due_date' } // desc
                    ]
                },
                status: {
                    label: this.$t('filterConfigLabel.status'),
                    multiple: true,
                    options: [
                        { text: this.$t('filterConfigOptions.scheduled'), value: 'NEW' },
                        { text: this.$t('filterConfigOptions.inProgress'), value: 'IN_PROGRESS' },
                        { text: this.$t('filterConfigOptions.pending'), value: 'PENDING' },
                        { text: this.$t('filterConfigOptions.completed'), value: 'COMPLETED' },
                        { text: this.$t('filterConfigOptions.cancelled'), value: 'CANCELLED' },
                    ]
                }
            },
            filter: {
                period: {
                    startDate:new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10).replace(/-/g, '-'),
                    endDate: new Date().toISOString().slice(0, 10).replace(/-/g, '-')
                },
                sort: 'end_date',
                status: ['NEW', 'IN_PROGRESS', 'PENDING', 'COMPLETED', 'CANCELLED']
            },
            initLoading: false,
            currentOptions: null,
        }
    },
    created() {
       this.init()
    },
    computed: {
        filteredList(){
            return this.list
        }
    },
    methods: {
        init(){
            var me = this
            me.$try({
                action: async () => {
                    me.loading = true;

                    let itemsPerPage = me.config.itemsPerPage ? me.config.itemsPerPage : 1
                    if(me.listType != '*') {
                        me.filterConfig.status.options = me.filterConfig.status.options.filter(option => me.listType.includes(option.value) )
                        me.filter.status = JSON.parse(JSON.stringify(me.listType))  
                    }
                    me.currentOptions = {
                        orderBy: me.filter.sort, 
                        range: {from: 0, to: itemsPerPage - 1},
                        startAt: me.filter.period.startDate,
                        endAt: `${me.filter.period.endDate} 23:59:59` // 종료일 23:59:59 추가
                    }
                    
                    me.list = await backend.getInstanceListByStatus(me.listType, me.currentOptions);
                    if(!me.initLoading) me.initLoading = true
                    me.loading = false                
                },
            });
        },
        handleRowClick(item) {
            this.$router.push(`/instancelist/${item.instId.replace(/\./g, '_DOT_')}`);
        },
        handleSearch(searchWord){
            var me = this
            me.$try({
                action: async () => {
                    me.loading = true;

                    if(searchWord){
                        let itemsPerPage = me.config.itemsPerPage ? me.config.itemsPerPage : 1
                        me.currentOptions = {
                            orderBy: me.filter.sort, 
                            range: {from: 0, to: itemsPerPage - 1},
                            startAt: me.filter.period.startDate,
                            endAt: `${me.filter.period.endDate} 23:59:59`,
                            like: {key: 'proc_inst_name', value: `%${searchWord}%`},
                        }
                        me.list = await backend.getInstanceListByStatus(me.listType, me.currentOptions);
                    } else {
                        me.init()
                    }
                    me.loading = false                
                }
            });
        },
        handleLoad(done) {
            var me = this
            me.$try({
                action: async () => {
                    me.loading = true;
                    let currntCnt = me.list.length
                    let itemsPerPage = me.config.itemsPerPage ? me.config.itemsPerPage : 1

                    me.currentOptions.range.from = currntCnt
                    me.currentOptions.range.to = currntCnt + itemsPerPage - 1

                    let list = await backend.getInstanceListByStatus(me.listType, me.currentOptions);
                    if(list && list.length > 0){
                        me.list.push(...list)
                        done('ok')
                    } else {
                        done('empty')
                    }

                    me.loading = false                
                },
                // successMsg: me.$t('successMsg.processExecutionCompleted')
            });
        },
        handleFilter(filter){
            var me = this
            me.$try({
                action: async () => {
                    me.loading = true;
                    let itemsPerPage = me.config.itemsPerPage ? me.config.itemsPerPage : 1

                   
                    me.currentOptions = {
                        sort: filter.sort == "start_date" ? "asc" : "desc",
                        orderBy: filter.sort, 
                        range: {from: 0, to: itemsPerPage - 1},
                        startAt: filter.period.startDate,
                        endAt: `${filter.period.endDate} 23:59:59`,
                    }
                    me.filter = filter

                    me.list = await backend.getInstanceListByStatus(me.listType, me.currentOptions);
                    me.loading = false                
                }
            });
        },
        formatDateTime(dateString) {
            const date = new Date(dateString);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            
            return `${year}년 ${month}월 ${day}일 ${hours}:${minutes}:${seconds}`;
        }
    }
  }
  </script>

<style scoped>
.completed-instances-style {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); /* 연한 그림자 */
}
</style>
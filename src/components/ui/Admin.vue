<template>
    <div>
        <v-card elevation="10" style="height:83vh">
            <v-card-title>{{ $t('admin.instanceList') }}</v-card-title>
            <v-data-table
                v-model:search="search"
                :items="sortedInstanceList"
                :headers="headers"
                :items-per-page="15"
                style="height:calc(100% - 42px); overflow: auto;"
            >
                <template v-slot:item.name="{ item }">
                    <div>{{ item.name }}</div>
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
                <template v-slot:item.subProcess="{ item }">
                    <v-icon v-if="item.subProcess" color="success">mdi-checkbox-marked-circle</v-icon>
                </template>
                <template v-slot:item.startedDate="{ item }">
                    <div>{{ formatDate(item.startedDate) }}</div>
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
    }),
    async created() {
        this.getInstanceList();
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
        sortedInstanceList() {
            return this.instanceList.slice().sort((a, b) => {
                return new Date(b.startedDate) - new Date(a.startedDate);
            });
        }
    },
    watch: {},
    methods: {
        formatDate(date) {
            const options = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric' };
            return new Date(date).toLocaleString('ko-KR', options);
        },
        viewDetail(item) {
            this.$router.push({ name: 'Admin Detail', params: { id: item.instId } });
        },
        async getInstanceList() {
            let me = this;
            await backend.getAllInstanceList().then((response) => {
                console.log(response);
                let result = [];
                response.forEach((item) => {
                    let instId = item._links.self.href.split('/').pop();
                    item.instId = instId;
                    result.push(item);
                });
                me.instanceList = result;
            });
        }
    }
};
</script>

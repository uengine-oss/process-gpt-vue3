<template>
    <div>
        <v-card elevation="10" style="height: calc(84vh); width: calc(154vh)">
            <v-card-title>InstanceList</v-card-title>
            <v-data-table v-model:search="search" :items="instanceList" :headers="headers">
                <template v-slot:item.name="{ item }">
                    <div @click="viewDetail(item)">
                        {{ item.name }}
                    </div>
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
                    <div>
                        <v-btn flat @click="viewDetail(item)">view</v-btn>
                    </div>
                </template>
                <template v-slot:item.subProcess="{ item }">
                    <v-icon v-if="item.subProcess" color="success">mdi-checkbox-marked-circle</v-icon>
                    <!-- <v-chip x color="success" prepend-icon="mdi-checkbox-marked-circle">
                    </v-chip> -->
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
        headers: [
            {
                align: 'start',
                key: 'instId',
                sortable: false,
                title: 'Instance ID'
            },
            { key: 'name', align: 'start', title: 'Name' },
            { key: 'status', align: 'start', title: 'Status' },
            { key: 'startedDate', align: 'start', title: 'Started Date' },
            { key: 'finishedDate', align: 'start', title: 'Finished Date' },
            { key: 'initEp', align: 'start', title: 'Initiator' },
            { key: 'subProcess', align: 'center', title: 'SubProcess' },
            { key: 'actions', align: 'start', title: 'Actions' }
        ]
    }),
    async created() {
        this.getInstanceList();
    },
    mounted() {},
    computed: {},
    watch: {},
    methods: {
        viewDetail(item) {
            this.$router.push({ name: 'Admin Detail', params: { id: item.instId } });
        },
        async getInstanceList() {
            let me = this;
            await backend.getAllInstanceList(0).then((response) => {
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

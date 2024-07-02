<template>
    <div>
        <v-card elevation="10" style="height: calc(84vh); width: calc(154vh)">
            <v-card-title>InstanceList</v-card-title>
            <v-data-table v-model:search="search" :items="instanceList" :headers="headers">
                <template v-slot:item.status="{ item }">
                    <div>
                        <v-chip v-if="item.selectable.status == 'Completed'" color="success">
                            {{ item.selectable.status }}
                        </v-chip>
                        <v-chip v-if="item.selectable.status == 'Running'" color="primary">
                            {{ item.selectable.status }}
                        </v-chip>
                        <v-chip v-if="item.selectable.status == 'Pending' || item.selectable.status == 'Stopped'">
                            {{ item.selectable.status }}
                        </v-chip>
                        <v-chip v-if="item.selectable.status == 'Failed'" color="error">
                            {{ item.selectable.status }}
                        </v-chip>
                    </div>
                </template>
                <template v-slot:item.actions="{ item }">
                    <div>
                        <v-btn flat @click="viewDetail(item.selectable)">view</v-btn>
                        <!-- <v-btn flat>bbb</v-btn> -->
                    </div>
                </template>
                <!-- <template v-slot:item.actions="{ item }">
                    <v-chip :text="item.rootInstId"></v-chip>
                </template> -->
            </v-data-table>
        </v-card>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

import { VDataTable } from 'vuetify/labs/VDataTable';

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
                key: 'rootInstId',
                sortable: false,
                title: 'Instance ID'
            },
            { key: 'name', align: 'start', title: 'Name' },
            { key: 'status', align: 'start', title: 'Status' },
            { key: 'startedDate', align: 'start', title: 'Started Date' },
            { key: 'finishedDate', align: 'start', title: 'Finished Date' },
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
            this.$router.push({ name: 'Admin Detail', params: { id: item.rootInstId } });
        },
        async getInstanceList() {
            let me = this;
            await backend.getAllInstanceList().then((response) => {
                console.log(response);
                me.instanceList = response;
            });
        }
    }
};
</script>

<template>
    <div>
        <v-card elevation="10" style="height: calc(84vh); width: calc(154vh)">
            <v-card-title>Instance - {{ instanceId }} </v-card-title>
            <v-tabs v-model="tab">
                <v-tab value="definition">Definition</v-tab>
                <v-tab value="variables">Variables</v-tab>
                <v-tab value="roles">Roles</v-tab>
            </v-tabs>
            <v-window v-model="tab" style="height: 100%">
                <v-window-item value="definition" style="height: calc(70vh)">
                    <BpmnUengine
                        v-if="loaded"
                        ref="bpmnVue"
                        :bpmn="processDefinition"
                        :options="options"
                        :isViewMode="true"
                        :adminMode="true"
                        :currentActivities="currentActivities"
                        v-on:openDefinition="(ele) => openSubProcess(ele)"
                        v-on:openPanel="(id) => openPanel(id)"
                        v-on:rollback="(id) => rollback(id)"
                        style="height: 100%"
                    ></BpmnUengine>
                    <div v-else>
                        No process definition
                    </div>
                </v-window-item>
                <v-window-item value="variables">
                    <v-data-table
                        :items="processVariables"
                        :headers="[
                            {
                                align: 'start',
                                key: 'key',
                                sortable: false,
                                title: 'Key'
                            },
                            { key: 'value', align: 'start', title: 'Value' }
                        ]"
                    ></v-data-table>
                </v-window-item>
                <v-window-item value="roles">
                    <v-data-table :items="roles" :headers="[{
                                align: 'start',
                                key: 'name',
                                sortable: false,
                                title: 'Name'
                            },
                            { key: 'endpoint', align: 'start', title: 'Endpoint' },
                            { key: 'resourceName', align: 'start', title: 'Resource Name' }
                        ]"></v-data-table>
                </v-window-item>
                <!-- <v-window-item value="Notification">
                            <NotificationTab/>
                        </v-window-item>
                        <v-window-item value="Bills">
                            <BillsTab/>
                        </v-window-item>
                        <v-window-item value="Security">
                            <SecurityTab/>
                        </v-window-item> -->
            </v-window>
        </v-card>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();
import BpmnUengine from '@/components/BpmnUengine.vue';
import customBpmnModule from '@/components/customBpmn';
import { VDataTable } from 'vuetify/components/VDataTable';
export default {
    name: 'admin-detail',
    components: {
        BpmnUengine,
        VDataTable
    },
    data: () => ({
        instanceId: null,
        instanceDetail: null,
        tab: 'definition',
        processDefinition: null,
        processVariables: [],
        loaded: false,
        options: {
            propertiesPanel: {
                invalidationList: {}
            },
            additionalModules: [customBpmnModule]
        },
        roles: [],
        currentActivities: [],
        activityVariables: {}

    }),
    async created() {
        await this.init();
    },
    mounted() {},
    computed: {},
    watch: {
        processDefinition() {
            console.log(this.processDefinition);
        },
        async $route(before, after) {
            await this.init();
        }
    },
    methods: {
        async init() {
            this.loaded = false
            this.instanceId = this.$route.params.id;
            await this.getInstanceDetail();
            await this.getProcessDefinition();
            await this.getProcessVariables();

            // this.getCurrentActivities();
        },
        viewDetail(item) {
            console.log(item);
        },
        async getInstanceDetail() {
            let me = this;
            await backend.getInstance(this.instanceId).then((response) => {
                console.log(response);
                me.instanceDetail = response;
            });
        },
        openSubProcess(e) {
            // this.$router.go("/adodm")
            this.$router.push({
                name: 'Admin Detail',
                params: { id: this.activityVariables[e.id]['instanceIdOfSubProcess'] }
            });
        },
        async getProcessDefinition() {
            let me = this;
            let encodedId = this.instanceDetail.defId;
            let decodedId = decodeURIComponent(encodedId);
            let options = {
                type: 'bpmn'
            };
            await backend.getRawDefinition(decodedId, options).then((response) => {
                me.processDefinition = response;
            });
        },
        async getProcessVariables() {
            let me = this;
            await backend.getProcessVariables(this.instanceDetail.instanceId).then((response) => {
                // me.processVariables = response;
                me.setVariableList(response);
            });
        },
        // getCurrentActivities() {
        //     let me = this;
        //     let keys = Object.keys(me.processVariables);
        //     for (let key of keys) {
        //         if(key.includes('_status')) {
        //             if(me.processVariables[key] == 'Completed' || me.processVariables[key] == 'Running') {
        //                 me.currentActivities.push(key.split(':')[0]);
        //             }
        //         }
        //     }
        // },
        async rollback(id) {
            let me = this;
            await backend
                .backToHere(this.instanceId, id)
                .then((response) => {
                    me.init();
                    alert('rollback success');
                })
                .catch((error) => {
                    alert(error);
                });
        },
        setVariableList(variables) {
            let me = this;
            me.processVariables = [];
            me.roles = [];
            me.activityVariables = {};
            me.currentActivities = []
            for(let key of Object.keys(variables)) {
                if (key.includes(':_roleMapping_of_')) {
                    let tmp = {
                        name: key.replace(':_roleMapping_of_', ''),
                        endpoint: variables[key].endpoint,
                        resourceName: variables[key].resourceName
                    };
                    me.roles.push(tmp);
                } else if (key.startsWith(':')) {
                    let tmp = { key: key, value: variables[key] };
                    me.processVariables.push(tmp);
                } else if (key.includes('_status')) {
                    if (variables[key] == 'Completed' || variables[key] == 'Running') {
                        me.currentActivities.push(key.split(':')[0]);
                    }
                } else {
                    if (key.includes(':')) {
                        let activity = key.split(':')[0];
                        let variableKey = key.split(':')[1];
                        let value = variables[key];
                        if(!me.activityVariables[activity]) {
                            me.activityVariables[activity] = {};
                        }
                        me.activityVariables[activity][variableKey] = value;
                    }
                }
            }
            
            me.loaded = true;
        }
    }
};
</script>

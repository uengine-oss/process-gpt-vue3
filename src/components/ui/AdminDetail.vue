<template>
    <div>
        <v-card elevation="10">
            <v-card-title>Instance - {{ instanceId }} 
                <div v-for="event in eventList" :key="event">
                    <v-btn @click="$try({context: this, action: () => fireMessage(event.tracingTag), successMsg: `${event.name} 실행 완료`})"> {{ event.name ? event.name : event.tracingTag }} 보내기 </v-btn>
                </div>
            </v-card-title>
            <v-row class="ma-0 pa-0 pb-2">
                <v-col class="ma-0 pa-0" 
                    cols="12"
                    lg="6"
                    md="12"
                    sm="12"
                    style="height:69vh;
                    overflow: auto;
                    border-right:solid 1px #ADADAD"
                >
                    <BpmnUengine
                        v-if="loaded"
                        ref="bpmnVue"
                        :bpmn="processDefinition"
                        :options="options"
                        :isViewMode="true"
                        :adminMode="true"
                        :currentActivities="currentActivities"
                        :executionScopeActivities="executionScopeActivities"
                        :selectedExecutionScope="selectedExecutionScope"
                        :task-status="taskStatus"
                        v-on:selectedExecutionScope="(scope) => (selectedExecutionScope = scope)"
                        v-on:openDefinition="(ele) => openSubProcess(ele)"
                        v-on:openPanel="(id) => openPanel(id)"
                        v-on:rollback="(id) => rollback(id)"
                        style="height: 100%"
                    ></BpmnUengine>
                    <div v-else>{{ $t('adminDetail.noProcessDefinition') }}</div>
                </v-col>
                <v-col class="ma-0 pa-4 pt-0" 
                    cols="12"
                    lg="6"
                    md="12"
                    sm="12"
                    style="height:69vh;
                    overflow: auto;"
                >
                    <v-tabs v-model="tab" color="primary">
                        <v-tab>{{ $t('adminDetail.processVariables') }}</v-tab>
                        <v-tab>{{ $t('adminDetail.properties') }}</v-tab>
                    </v-tabs>
                    <v-window v-model="tab">
                        <v-window-item>
                            <v-data-table
                                :items="processVariables"
                                :headers="headers"
                                item-value="key"
                                class="elevation-1 custom-table"
                            >
                                <template v-slot:[`item.key`]="{ item }">
                                    <span>{{ item.key }}</span>
                                </template>
                                <template  v-slot:[`item.value`]="{ item }">
                                    <v-text-field
                                        v-if="item.editMode"
                                        v-model="item.value"
                                        outlined
                                        dense
                                        hide-details="true"
                                    ></v-text-field>
                                    <span v-else style="white-space: pre-wrap;">{{ item.value }}</span>
                                </template>
                                <template v-slot:[`item.save`]="{ item }">
                                    <v-tooltip v-if="item.editMode" :text="$t('adminDetail.save')">
                                        <template v-slot:activator="{ props }">
                                            <v-btn
                                                @click="updateItem(item)"
                                                v-bind="props"
                                                icon variant="text"
                                                density="comfortable"
                                            >
                                                <Icons :icon="'save'" :size="18" class="text-primary"/>
                                            </v-btn>
                                        </template>
                                    </v-tooltip>
                                    <v-tooltip v-else :text="$t('adminDetail.edit')">
                                        <template v-slot:activator="{ props }">
                                            <v-btn @click="item.editMode = true"
                                                v-bind="props" density="comfortable" icon flat 
                                            >
                                                <PencilIcon stroke-width="1.5" size="18" class="text-primary" />
                                            </v-btn>
                                        </template>
                                    </v-tooltip>
                                </template>
                            </v-data-table>
                        </v-window-item>
                        <v-window-item>
                            <v-data-table
                                :items="properties"
                                :headers="headers"
                                item-value="key"
                                :items-per-page="10"
                                class="elevation-1 custom-table"
                            >
                                <template v-slot:[`item.key`]="{ item }">
                                    <span>{{ item.key }}</span>
                                </template>
                                <template  v-slot:[`item.value`]="{ item }">
                                    <v-text-field
                                        v-if="item.editMode"
                                        v-model="item.value"
                                        outlined
                                        dense
                                        hide-details="true"
                                    ></v-text-field>
                                    <span v-else style="white-space: pre-wrap;">{{ item.value }}</span>
                                </template>
                                <template v-slot:[`item.save`]="{ item }">
                                    <v-tooltip v-if="item.editMode" :text="$t('adminDetail.save')">
                                        <template v-slot:activator="{ props }">
                                            <v-btn
                                                @click="updateItem(item)"
                                                v-bind="props"
                                                icon variant="text"
                                                density="comfortable"
                                            >
                                                <Icons :icon="'save'" :size="18" class="text-primary"/>
                                            </v-btn>
                                        </template>
                                    </v-tooltip>
                                    <v-tooltip v-else :text="$t('adminDetail.edit')">
                                        <template v-slot:activator="{ props }">
                                            <v-btn @click="item.editMode = true"
                                                v-bind="props" density="comfortable" icon flat 
                                            >
                                                <PencilIcon stroke-width="1.5" size="18" class="text-primary" />
                                            </v-btn>
                                        </template>
                                    </v-tooltip>
                                </template>
                            </v-data-table>
                        </v-window-item>
                    </v-window>
                </v-col>
            </v-row>
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
        tab: null,
        processDefinition: null,
        processVariables: [],
        properties: [],
        executionScopeActivities: {},
        loaded: false,
        eventList: [],
        options: {
            propertiesPanel: {
                invalidationList: {}
            },
            additionalModules: [customBpmnModule]
        },
        roles: [],
        currentActivities: [],
        activityVariables: {},
        selectedExecutionScope: null,
        taskStatus:{}
    }),
    async created() {
        await this.init();
    },
    mounted() {
        this.headers = [
            {
                title: this.$t('adminDetail.key'),
                align: 'start',
                key: 'key',
                sortable: false,
            },
            {
                title: this.$t('adminDetail.value'),
                align: 'start',
                key: 'value',
            },
            {
                title: this.$t('adminDetail.tools'),
                align: 'start',
                key: 'save',
            },
        ];
    },
    computed: {},
    watch: {
        processDefinition() {
        },
        async $route(before, after) {
            await this.init();
        },
        selectedExecutionScope(value) {
            console.log(value);
            this.init();
        }
    },
    methods: {
        async init() {  
            let me = this;
            let startTime = performance.now();
            this.loaded = false;
            this.instanceId = this.$route.params.id;
            this.eventList = await backend.getEventList(this.instanceId);
            await this.getInstanceDetail();
            await this.getProcessDefinition();
            me.$try({
                action: async () => {
                    me.taskStatus = await backend.getActivitiesStatus(this.instanceId);
                }
            });
            await this.getProcessVariables();
            let endTime = performance.now();
            console.log(`Result Time :  ${endTime - startTime} ms`);
            // this.getCurrentActivities();
        },
        viewDetail(item) {
            console.log(item);
        },
        async getInstanceDetail() {
            let startTime = performance.now();
            let me = this;
            await backend.getInstance(this.instanceId).then((response) => {
                me.instanceDetail = response;
                let endTime = performance.now();
                console.log(`getInstanceDetail Result Time :  ${endTime - startTime} ms`);
            });
        },
        openSubProcess(e) {
            // this.$router.go("/adodm")
            this.$router.push({
                name: 'Admin Detail',
                params: { id: this.activityVariables[e.id]['instanceIdOfSubProcess'] }
            });
        },
        fireMessage(event) {
            backend.fireMessage(this.instanceId, event);
        },
        async getProcessDefinition() {
            let startTime = performance.now();
            let me = this;
            let encodedId = this.instanceDetail.defId;
            let decodedId = decodeURIComponent(encodedId);
            let options = {
                type: 'bpmn',
                version: this.instanceDetail.defVer
            };
            await backend.getRawDefinition(decodedId, options).then((response) => {
                me.processDefinition = response;
                let endTime = performance.now();
                console.log(`getProcessDefinition Result Time :  ${endTime - startTime} ms`);
            });
        },
        async getProcessVariables() {
            let startTime = performance.now();
            let me = this;
            await backend.getProcessVariables(this.instanceDetail.instanceId).then((response) => {
                // me.processVariables = response;
                me.setVariableList(response);
                let endTime = performance.now();
                console.log(`getProcessVariables Result Time :  ${endTime - startTime} ms`);
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
        async rollback(ele) {
            let me = this;
            console.log(ele);
            let id = null;
            if (ele.businessObject.$parent.$type == 'bpmn:SubProcess') {
                id = ele.id + ':' + this.selectedExecutionScope.executionScope;
            } else {
                id = ele.id;
            }
            console.log(id);
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
            let startTime = performance.now();
            let me = this;
            me.processVariables = [];
            me.roles = [];
            me.activityVariables = {};
            me.currentActivities = [];
            for (let key of Object.keys(variables)) {
                let count = (key.match(new RegExp(':', 'g')) || []).length;
                if (key.includes('_executionScopes')) {
                    const executionScopes = variables[key];
                    let result = {};
                    for(let scope of executionScopes) {
                    // executionScopes.forEach((scope) => {
                        if (!result[scope.rootActivityTracingTag]) {
                            result[scope.rootActivityTracingTag] = {};
                        }
                        // result[scope.executionScope].push(scope);
                        let obj = {
                            parent: scope.parent ? scope.parent.executionScope : null
                        };
                        result[scope.rootActivityTracingTag][scope.executionScope] = obj;
                        // result[scope.rootActivityTracingTag].push(obj);
                        // console.log(scope);
                    }
                    // });

                    me.executionScopeActivities = result;
                }
                if (key.includes(':_roleMapping_of_')) {
                    let tmp = {
                        name: key.replace(':_roleMapping_of_', ''),
                        endpoint: variables[key].endpoint,
                        resourceName: variables[key].resourceName
                    };
                    me.roles.push(tmp);
                } else if (key.startsWith(':')) {
                    if(key.includes('_executionScopes')) {
                        continue;
                    }
                    let newStr = key.slice(1);
                    let validateText = newStr.split(':')[0];
                    if (!isNaN(validateText)) {
                        // executionScope
                        if(me.selectedExecutionScope) {
                            if (validateText != me.selectedExecutionScope.executionScope) {
                                continue;
                            }
                        }
                        let tmp = { key: key.split(':').slice(1).join(':'), value: JSON.stringify(variables[key]) }; 
                        if(key.includes(':prop')) {
                            me.properties.push(tmp);
                        } else {
                            me.processVariables.push(tmp);
                        }
                    } else {
                        let tmp = { key: key.split(':').slice(1).join(':'), value: JSON.stringify(variables[key]) };
                        if(key.includes(':prop')) {
                            me.properties.push(tmp);
                        } else {
                            me.processVariables.push(tmp);
                        }
                    }
                    // if(validateText != me.selectedExecutionScope) {
                    //     continue;
                    // }
                } else if (key.includes('_status')) {
                    if (variables[key] == 'Completed' || variables[key] == 'Running') {
                        if (count == 3) {
                            let executionScope = key.split(':')[1];
                            if(me.selectedExecutionScope) { 
                                if (me.selectedExecutionScope.executionScope == executionScope) {
                                    me.currentActivities.push(key.split(':')[0]);
                                }
                            }
                        } else if (count == 2) {
                            me.currentActivities.push(key.split(':')[0]);
                        }
                    }
                } else {
                    if (key.includes(':')) {
                        if (key.includes('ExecutionScope')) {
                            continue;
                            // let activity = key.split(':')[0];
                            // let executionScopes = variables[key];
                            // let tmp = {
                            //     activity: activity,
                            //     executionScopes: executionScopes
                            // };
                            // me.executionScopeActivities.push(tmp);
                        }
                        if (count == 2) {
                            let activity = key.split(':')[0];
                            let variableKey = key.split(':')[1];
                            let value = variables[key];
                            if (!me.activityVariables[activity]) {
                                me.activityVariables[activity] = {};
                            }
                            me.activityVariables[activity][variableKey] = value;
                        } else if (count == 3) {
                            let activity = key.split(':')[0];
                            let executionScope = key.split(':')[1];
                            let variableKey = key.split(':')[2];
                            let value = variables[key];
                            if (!me.activityVariables[activity]) {
                                me.activityVariables[activity] = {};
                            }
                            me.activityVariables[activity][variableKey] = value;
                        }
                    }
                }
            }

            me.loaded = true;
            let endTime = performance.now();
            console.log(`setVariableList Result Time :  ${endTime - startTime} ms`);
        },
        async updateItem(item) {
            let me = this;
            let key = item.key;
            let value = JSON.parse(item.value);
            item.editMode = false;
            await backend.setVariable(me.instanceId, key, value);
        }
    }
};
</script>

<style>
.custom-table th {
    white-space: nowrap !important; /* 텍스트를 한 줄로 표시 */
    text-align: center !important; /* 텍스트 가운데 정렬 */
    writing-mode: horizontal-tb !important; /* 텍스트 방향을 가로로 설정 */
}
</style>
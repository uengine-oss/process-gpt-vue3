<template>
     <v-card elevation="10" v-if="instance" style="height:calc(100vh - 155px)" :key="updatedKey">
        <v-card-title>
            <v-row class="ma-0 pa-0">
                <h3>{{instance.name}}(ID: {{instance.instanceId}})</h3>
                <v-chip size="x-small" variant="outlined" style="margin:2px 0px 0px 5px !important; display: flex; align-items: center;"> {{instance.status}} </v-chip>
            </v-row>
        </v-card-title>
        <v-row class="ma-0 pa-0">
             <!-- Left -->
            <v-col class="pa-0" cols="4">
                <v-card elevation="10" class="pa-4">
                    <v-card-title>프로세스 진행상태</v-card-title>
                    <div class="pa-0" style="overflow:auto; height: calc(100vh - 620px);">
                        <div v-if="bpmn" style="height: 100%;">
                            <process-definition class="work-item-definition" :currentActivities="currentActivities" :bpmn="bpmn" :key="updatedDefKey" :isViewMode="true"></process-definition>
                        </div>
                        <dif v-else>
                            No BPMN found
                        </dif>
                    </div>
                </v-card>
            </v-col>
            <!-- Right -->
            <v-col class="pa-0" cols="8">
                <v-card elevation="10" class="pa-4">
                    <perfect-scrollbar v-if="messages.length > 0" class="h-100" ref="scrollContainer" @scroll="handleScroll">
                        <div class="d-flex w-100" style="height: calc(100vh - 300px); overflow: auto;">
                            <component :is="'work-history-'+mode" :messages="messages" @clickMessage="navigateToWorkItemByTaskId" />
                        </div>
                    </perfect-scrollbar>
                </v-card>
            </v-col>
        </v-row>
    </v-card>
    <v-card v-else>
        <!-- 존재 하지 않은 인스턴스 -->
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import ProcessDefinition from '@/components/ProcessDefinition.vue';

import WorkItemChat from "@/components/ui/WorkItemChat.vue";
import ProcessInstanceChat from '@/components/ProcessInstanceChat.vue';

const backend = BackendFactory.createBackend()
export default {
    components: {
        ProcessDefinition,
        'work-history-uEngine': WorkItemChat,
        'work-history-ProcessGPT': ProcessInstanceChat
    },
    data: () => ({
        bpmn: null,
        instance: null,
        workListByInstId: null,
        currentActivities: [],

        // status variables
        updatedKey: 0,
        updatedDefKey: 0,
    }),
    created() {
        this.init();
    },
    computed:{
        mode(){
            return window.$mode;
        },
        id() {
            return this.$route.params.instId
        }, 
        messages(){
            if(!this.workListByInstId) return []
            return this.workListByInstId.map(workItem => ({
                profile: 'https://avatars0.githubusercontent.com/u/9064066?v=4&s=460',
                roleName: workItem.task.roleName,
                _item: workItem,
                content: workItem.title,
                description: workItem.description,
                timeStamp: workItem.startDate
            }))
        },
    },
    methods: {
        init() {
            var me = this
            me.$try({
                context: me,
                action: async () => {
                    if(!me.id) return
                    me.instance = await backend.getInstance(me.id);
                    me.bpmn = await backend.getRawDefinition(me.instance.defId, {type: 'bpmn'});
                    me.workListByInstId = await backend.getWorkListByInstId(me.instance.instanceId);
                   
                    me.currentActivities = me.workListByInstId.map(item=>item.tracingTag)
                    me.updatedDefKey++
                }
            })
        },
        delay(time) {
            return new Promise(resolve => setTimeout(resolve, time));
        },
    },
}
</script>
<style>
.work-itme-current-component .v-checkbox .v-input__details {
    display: none;
}
.work-itme-current-component .v-checkbox {
    height:40px;
}
.work-itme-current-component .v-checkbox label {
    opacity: 0.6 !important;
}
.work-itme-current-component .form-checkbox-label {
    font-size:20px;
    font-weight:500;
}
.work-itme-current-component .form-radio-box {
    margin-top:25px;
}
.work-itme-current-component .form-radio-box .v-radio-group {
    margin-top:8px;
}
.work-itme-current-component .form-radio-box .form-radio-label {
    font-size:20px;
    font-weight:500;
}

.work-itme-current-component .form-label {
    font-size:20px;
    font-weight:500;
}
</style>
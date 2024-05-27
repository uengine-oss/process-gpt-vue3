<template>
    <AppBaseCard>
        <template v-slot:leftpart>
            <v-card flat>
                <v-card-title>프로세스 진행상태</v-card-title>
                <div style="overflow: auto;">
                    <div v-if="bpmn" style="height: 100%">
                        <process-definition
                            class="work-item-definition"
                            :currentActivities="currentActivities"
                            :bpmn="bpmn"
                            :key="updatedDefKey"
                            :isViewMode="true"
                        ></process-definition>
                    </div>
                    <dif v-else> No BPMN found </dif>
                </div>
            </v-card>
        </template>
        <template v-slot:rightpart>
            <v-card flat>
                <perfect-scrollbar v-if="messages.length > 0" class="h-100" ref="scrollContainer" @scroll="handleScroll">
                    <div class="d-flex w-100">
                        <component :is="'work-history-' + mode" :messages="messages" :isComplete="isComplete"
                            @clickMessage="navigateToWorkItemByTaskId" />
                    </div>
                </perfect-scrollbar>
            </v-card>
        </template>

        <template v-slot:mobileLeftContent>
            <v-card flat>
                <v-card-title>프로세스 진행상태</v-card-title>
                <div style="overflow: auto; height: calc(100vh - 620px)">
                    <div v-if="bpmn" style="height: 100%">
                        <process-definition
                            class="work-item-definition"
                            :currentActivities="currentActivities"
                            :bpmn="bpmn"
                            :key="updatedDefKey"
                            :isViewMode="true"
                        ></process-definition>
                    </div>
                    <dif v-else> No BPMN found </dif>
                </div>
            </v-card>
        </template>
    </AppBaseCard>
</template>

<script>
import AppBaseCard from '@/components/shared/AppBaseCard.vue';

import ProcessDefinition from '@/components/ProcessDefinition.vue';

import WorkItemChat from '@/components/ui/WorkItemChat.vue';
import ProcessInstanceChat from '@/components/ProcessInstanceChat.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        ProcessDefinition,
        'work-history-uEngine': WorkItemChat,
        'work-history-ProcessGPT': ProcessInstanceChat,
        AppBaseCard
    },
    data: () => ({
        bpmn: null,
        instance: null,
        workListByInstId: null,
        currentActivities: [],
        // status variables
        updatedKey: 0,
        updatedDefKey: 0,
        eventList: [],
    }),
    created() {
        this.init();
        this.EventBus.on('process-definition-updated', async () => {
            this.bpmn = await backend.getRawDefinition(this.instance.defId, { type: 'bpmn' });
            this.updatedDefKey++;
        });
    },
    computed: {
        mode() {
            return window.$mode;
        },
        id() {
            return atob(this.$route.params.instId);
        },
        messages() {
            if (!this.workListByInstId) return [];
            return this.workListByInstId.map((workItem) => ({
                profile: 'https://avatars0.githubusercontent.com/u/9064066?v=4&s=460',
                roleName: workItem.task.roleName,
                _item: workItem,
                content: workItem.title,
                description: workItem.description,
                timeStamp: workItem.startDate
            }));
        },
        isComplete(){
            return this.instance.status == "COMPLETED"
        },
    },
    methods: {
        init() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (!me.id) return;
                    me.instance = await backend.getInstance(me.id);
                    me.bpmn = await backend.getRawDefinition(me.instance.defId, { type: 'bpmn' });
                    me.workListByInstId = await backend.getWorkListByInstId(me.instance.instanceId);
                    me.currentActivities = me.workListByInstId.map((item) => item.tracingTag);
                    me.eventList = await backend.getEventList(me.instance.instanceId);
                    me.updatedDefKey++;
                }
            });
        },
        delay(time) {
            return new Promise((resolve) => setTimeout(resolve, time));
        },
        fireMessage(event) {
            backend.fireMessage(this.instance.instanceId, event);
        }
    }
};
</script>
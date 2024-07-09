<template>
    <div>
        <perfect-scrollbar v-if="messages.length > 0" class="h-100" ref="scrollContainer" @scroll="handleScroll">
            <div class="d-flex w-100">
                <component :is="'work-history-' + mode" :messages="messages" :isComplete="isComplete"
                    @clickMessage="navigateToWorkItemByTaskId" />
            </div>
        </perfect-scrollbar>
    </div>
</template>

<script>
import WorkItemChat from '@/components/ui/WorkItemChat.vue';
import ProcessInstanceChat from '@/components/ProcessInstanceChat.vue';
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        'work-history-uEngine': WorkItemChat,
        'work-history-ProcessGPT': ProcessInstanceChat,
    },
    props: {
        instance: Object,
    },
    data: () => ({
        bpmn: null,
        workListByInstId: null,
        currentActivities: [],
        // status variables
        updatedKey: 0,
        updatedDefKey: 0,
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
                    if (me.instance) {
                        me.bpmn = await backend.getRawDefinition(me.instance.defId, { type: 'bpmn' });
                        me.workListByInstId = await backend.getWorkListByInstId(me.instance.instanceId);
                        if (me.mode == 'ProcessGPT') {
                            me.currentActivities = me.instance.current_activity_ids;
                        } else {
                            me.currentActivities = me.workListByInstId.map((item) => item.tracingTag);
                        }
                        me.updatedDefKey++;
                    }
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
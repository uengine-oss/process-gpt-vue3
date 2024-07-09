<template>
    <v-card flat style="height: calc(100vh - 260px)">
        <perfect-scrollbar v-if="messages.length > 0" class="h-100" ref="scrollContainer" @scroll="handleScroll">
            <div class="d-flex w-100">
                <component :is="'work-history-' + mode" :messages="messages" :isComplete="isComplete"
                    @clickMessage="navigateToWorkItemByTaskId" />
            </div>
        </perfect-scrollbar>
    </v-card>
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
        workListByInstId: null,
        updatedKey: 0,
    }),
    created() {
        this.init();
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
                        me.workListByInstId = await backend.getWorkListByInstId(me.instance.instanceId);
                        if (me.mode == 'ProcessGPT') {
                            me.currentActivities = me.instance.current_activity_ids;
                        } else {
                            me.currentActivities = me.workListByInstId.map((item) => item.tracingTag);
                        }
                        me.updatedKey++;
                    }
                }
            });
        },
        delay(time) {
            return new Promise((resolve) => setTimeout(resolve, time));
        },
        navigateToWorkItemByTaskId(obj) {
            var me = this;
            me.$router.push(`/todolist/${obj._item.taskId}`);
            this.$nextTick(() => {
                me.delay(500).then(() => {
                    me.init();
                    me.updatedKey++;
                });
            });
        },
    }
};
</script>
<template>
    <div style="height: 100%">
        <div style="overflow: auto; height: 100%">
            <div v-if="bpmn" style="height: 100%">
                <process-definition
                    class="work-item-definition"
                    style="height: 100%"
                    :currentActivities="currentActivities"
                    :bpmn="bpmn"
                    :key="updatedDefKey"
                    :isViewMode="true"
                ></process-definition>
            </div>
            <dif v-else class="no-bpmn-found-text"> No BPMN found </dif>
        </div>
    </div>
</template>

<script>

import ProcessDefinition from '@/components/ProcessDefinition.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        ProcessDefinition,
    },
    props: {
        instance: Object,
    },
    data: () => ({
        bpmn: null,
        currentActivities: [],
        updatedKey: 0,
        updatedDefKey: 0,
    }),
    created() {
        this.init();
        this.EventBus.on('process-definition-updated', async () => {
            console.log(this.instance)
            this.bpmn = await backend.getRawDefinition(this.instance.defId, { type: 'bpmn', version: this.instance.defVer });
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
    },
    watch: {
        instance: {
            deep: true,
            async handler(newVal, oldVal) {
                if (newVal.instanceId !== oldVal.instanceId) {
                    await this.init();
                }
            }
        },
    },
    methods: {
        init() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (me.instance) {
                        me.bpmn = await backend.getRawDefinition(me.instance.defId, { type: 'bpmn', version: this.instance.defVer });
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
    }
};
</script>
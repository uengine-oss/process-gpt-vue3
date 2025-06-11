<template>
    <div style="height: 100%">
        <div style="overflow: auto; height: 100%">
            <div v-if="bpmn" style="height: 100%">
                <BpmnUengine
                    ref="bpmnVue"
                    :instanceId="$route.params.instId"
                    :key= "updatedDefKey"
                    :bpmn="bpmn"
                    :options="options"
                    :taskStatus="taskStatus"
                    style="height: 100%"
                ></BpmnUengine>
            </div>
            <dif v-else class="no-bpmn-found-text"> No BPMN found </dif>
        </div>
    </div>
</template>

<script>

import ProcessDefinition from '@/components/ProcessDefinition.vue';

import customBpmnModule from '@/components/customBpmn';
import BpmnUengine from '@/components/BpmnUengineViewer.vue';
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        ProcessDefinition,
        BpmnUengine
    },
    props: {
        instance: Object,
    },
    data: () => ({
        bpmn: null,
        updatedKey: 0,
        updatedDefKey: 0,
        taskStatus: null,
        options: {
            additionalModules: [customBpmnModule]
        },
    }),
    created() {
        this.init();
        this.EventBus.on('process-definition-updated', async () => {
            this.bpmn = await backend.getRawDefinition(this.instance.defId, { type: 'bpmn', version: this.instance.defVer });
            this.updatedDefKey++;
        });
    },
    mounted() {
        let me = this;
        me.$try({
            action: async () => {
                if(me.$route.params && me.$route.params.instId) {
                    await me.initStatus();
                }
            }
        });
    },
    computed: {
        id() {
            return decodeURIComponent(atob(this.$route.params.instId));
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
                        await me.initStatus();
                        me.updatedDefKey++;
                    }
                }
            });
        },
        async initStatus() {
            var me = this;
            me.taskStatus = await backend.getActivitiesStatus(me.instance.instId);
            me.updatedDefKey++;
        }
    }
};
</script>
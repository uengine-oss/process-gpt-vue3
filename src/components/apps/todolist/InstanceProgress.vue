<template>
    <div style="height: 100%; position: relative">
        <div style="overflow: auto; height: 100%">
            <div v-if="compareData" style="height: 67vh">
                <ProcessFeedbackCompare
                    :before-xml="compareData.beforeXml"
                    :after-xml="compareData.afterXml"
                    :changes="compareData.changes"
                    :diff-activities-a="compareData.diffActivitiesA"
                    :diff-activities-b="compareData.diffActivitiesB"
                    :summary="compareData.summary"
                    :is-applying="isApplyingFeedback"
                    @apply="onCompareApply"
                    @cancel="onCompareCancel"
                />
            </div>
            <div v-else-if="bpmn" style="height: 100%">
                <BpmnUengine
                    ref="bpmnVue"
                    :instanceId="instance.instId"
                    :key="updatedDefKey"
                    :bpmn="bpmn"
                    :options="options"
                    :taskStatus="taskStatus"
                    style="height: 67vh;"
                    @openFeedbackPanel="onOpenFeedbackPanel"
                ></BpmnUengine>
            </div>
            <span v-else class="no-bpmn-found-text"
                >BPMN 정보 불러오는 중
                <span class="loading-dots">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                </span>
            </span>
        </div>

        <ProcessFeedbackDrawer
            v-model="feedbackDrawerOpen"
            :instanceId="feedbackInstanceId"
            :activityId="feedbackActivityId"
            @startCompare="onStartCompare"
        />
    </div>
</template>

<script>
import ProcessDefinition from '@/components/ProcessDefinition.vue';

import customBpmnModule from '@/components/customBpmn';
import BpmnUengine from '@/components/BpmnUengineViewer.vue';
import ProcessFeedbackDrawer from '@/components/ui/ProcessFeedbackDrawer.vue';
import ProcessFeedbackCompare from '@/components/ui/ProcessFeedbackCompare.vue';
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        ProcessDefinition,
        BpmnUengine,
        ProcessFeedbackDrawer,
        ProcessFeedbackCompare
    },
    props: {
        instance: Object
    },
    data: () => ({
        bpmn: null,
        updatedKey: 0,
        updatedDefKey: 0,
        taskStatus: null,
        feedbackDrawerOpen: false,
        feedbackInstanceId: '',
        feedbackActivityId: '',
        compareData: null,
        isApplyingFeedback: false,
        options: {
            additionalModules: [customBpmnModule]
        }
    }),
    created() {
        this.init({ noLoading: true });
        this.EventBus.on('process-definition-updated', async () => {
            this.bpmn = await backend.getRawDefinition(this.instance.defId, { type: 'bpmn', version: this.instance.defVer });
            this.updatedDefKey++;
        });
    },
    mounted() {
        let me = this;
        me.$try({
            noLoading: true,
            action: async () => {
                if (me.$route.params && me.$route.params.instId) {
                    await me.initStatus();
                }
            }
        });
    },
    computed: {
        id() {
            if (this.$route.params.instId) {
                return this.$route.params.instId.replace(/_DOT_/g, '.');
            } else {
                return null;
            }
        },
        mode() {
            return window.$mode;
        }
    },
    watch: {
        $route: {
            deep: true,
            async handler(newVal, oldVal) {
                if (newVal.params.instId !== oldVal.params.instId) {
                    await this.init({ noLoading: true });
                }
            }
        },
        instance: {
            deep: true,
            async handler(newVal, oldVal) {
                if (newVal && (!oldVal || newVal.instId !== oldVal.instId)) {
                    await this.init({ noLoading: true });
                }
            }
        }
    },
    methods: {
        init(options = {}) {
            var me = this;
            me.$try({
                context: me,
                noLoading: options.noLoading,
                action: async () => {
                    if (me.instance && me.instance.defId) {
                        if (me.mode == 'ProcessGPT') {
                            me.bpmn = await backend.getRawDefinition(me.instance.defId, { type: 'bpmn', version: this.instance.version });
                        } else {
                            me.bpmn = await backend.getRawDefinition(me.instance.defId, { type: 'bpmn', version: this.instance.defVer });
                        }
                        await me.initStatus();
                        me.updatedDefKey++;
                    }
                }
            });
        },
        async initStatus() {
            var me = this;
            let instId = me.instance.instId || me.instance.instanceId;
            me.taskStatus = await backend.getActivitiesStatus(instId);
            me.updatedDefKey++;
        },
        onOpenFeedbackPanel({ instanceId, activityId }) {
            this.feedbackInstanceId = instanceId;
            this.feedbackActivityId = activityId;
            this.feedbackDrawerOpen = true;
        },
        // 드로어는 좌우 비교를 담기엔 너무 좁아서(480px), 개선안이 준비되면 드로어를 닫고
        // 메인 다이어그램 영역 자리에 좌우 비교(ProcessFeedbackCompare)를 대신 띄운다.
        onStartCompare(payload) {
            this.compareData = payload;
            this.feedbackDrawerOpen = false;
        },
        onCompareCancel() {
            this.compareData = null;
        },
        async onCompareApply(selectedIds) {
            if (!this.compareData || !this.compareData.task) return;
            this.isApplyingFeedback = true;
            try {
                await backend.applyFeedback(
                    {
                        selectedIds,
                        changes: this.compareData.changes,
                        beforeXml: this.compareData.beforeXml,
                        afterXml: this.compareData.afterXml
                    },
                    this.compareData.task.id
                );
                this.compareData = null;
                // 반영 후 새 proc_def_version이 생성되고 워크아이템이 재실행되므로,
                // 다이어그램을 새 버전으로 다시 로드해 변경 사항이 실제로 보이는지 반영한다.
                await this.init({ noLoading: true });
            } finally {
                this.isApplyingFeedback = false;
            }
        }
    }
};
</script>

<template>
    <div>
        <!-- Description -->
        <Description v-model="copyUengineProperties.description" class="mb-4"></Description>

        <!-- Instruction -->
        <Instruction
            v-model="copyUengineProperties.instruction"
            :mention-candidates="mentionCandidates"
            :isViewMode="isViewMode"
            class="mb-4"
        ></Instruction>
    </div>
</template>

<script>
import { useBpmnStore } from '@/stores/bpmn';
import Description from '@/components/designer/DescriptionField.vue';
import Instruction from '@/components/designer/InstructionField.vue';

export default {
    name: 'gpt-ad-hoc-sub-process-panel',
    components: {
        Description,
        Instruction
    },
    props: {
        uengineProperties: Object,
        isViewMode: Boolean
    },
    data() {
        return {
            calleeDefinitionRoles: [],
            copyUengineProperties: JSON.parse(JSON.stringify(this.uengineProperties)),
            mentionCandidates: [],
            bpmnModeler: null
        };
    },
    async mounted() {
        let me = this;
        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;
        let def = this.bpmnModeler.getDefinitions();
        const processElement = def.rootElements.filter((element) => element.$type === 'bpmn:Process');
        if (!processElement) {
            console.error('bpmn:Process element not found');
            return;
        }
        processElement.forEach((process) => {
            (process.laneSets || []).forEach((laneSet) => {
                (laneSet.lanes || []).forEach((lane) => {
                    if (lane?.name?.length > 0) me.calleeDefinitionRoles.push(lane.name);
                });
            });
        });
    },
    watch: {},
    methods: {
        beforeSave() {
            const props = {
                ...this.copyUengineProperties,
                description: this.copyUengineProperties.description || '',
                instruction: this.copyUengineProperties.instruction || ''
            };
            this.copyUengineProperties = props;
            this.$emit('update:uengineProperties', props);
        }
    }
};
</script>

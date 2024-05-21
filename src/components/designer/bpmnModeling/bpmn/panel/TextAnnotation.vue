<template>
    <div>
        <div class="included" style="margin-bottom: 22px">
            <div style="margin-bottom: 8px">Text Annotation</div>
            <v-textarea v-model="copyText"></v-textarea>
        </div>
    </div>
</template>
<script>
import { useBpmnStore } from '@/stores/bpmn';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
const storage = StorageBaseFactory.getStorage();

export default {
    name: 'text-annotation-panel',
    props: {
        element: Object,
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean
    },
    created() {
        this.copyText = this.element.text
    },
    data() {
        return {
            definitions: [],
            definitionRoles: [],
            calleeDefinitionRoles: [],
            copyUengineProperties: this.uengineProperties,
            name: '',
            checkpoints: [],
            editCheckpoint: false,
            checkpointMessage: {
                $type: 'uengine:Checkpoint',
                checkpoint: ''
            },
            code: '',
            description: '',
            selectedDefinition: '',
            bpmnModeler: null,
            stroage: null,
            editParam: false,
            paramKey: '',
            paramValue: '',
            definitionCnt: 0,
            type: 'None'
        };
    },
    async mounted() {},
    computed: {},
    watch: {
        copyText: _.debounce(function(newVal){
            this.$emit("update:text", newVal)
        }, 500)
    },
    methods: {}
};
</script>

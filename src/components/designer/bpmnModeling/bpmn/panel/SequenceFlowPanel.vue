<template>
    <div>
        <div>{{ $t('BpnmPropertyPanel.condition') }}</div>
        <diV>
            {{ copyUengineProperties.condition }}
        </div>
        <!-- <v-text-field v-model="condition.key" />
        <v-text-field v-model="condition.value" /> -->
        <!-- <v-btn @click="addCondition">조건 추가</v-btn> -->
    </div>
</template>
<script>
import { useBpmnStore } from '@/stores/bpmn';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import { Icon } from '@iconify/vue';
const storage = StorageBaseFactory.getStorage()
export default {
    name: 'sequence-flow-panel',
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean
    },
    created() {

    },
    data() {
        return {
            requiredKeyLists: {
                "description": "",
                "role": { "name": "" },
                "parameters": [],
                "checkpoints": [],
                "condition": []
            },
            copyUengineProperties: this.uengineProperties
        };
    },
    async mounted() {
        let me = this
        if (!me.$app.try) {
            me.$app = me.$app._component.methods;
        }
        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;
    },
    computed: {

    },
    watch: {
    },
    methods: {
        ensureKeyExists(obj, key, defaultValue) {
            if (!obj.hasOwnProperty(key)) {
                obj[key] = defaultValue;
            }
        },
        addCondition() {
            let condition = {
                "condition": {
                    "_type": "org.uengine.kernel.Evaluate",
                    "key": "troubleType",
                    "value": "sw"
                }
            }
            this.copyUengineProperties.condition.push(condition)
            this.$emit('update:uengineProperties', this.copyUengineProperties)
        },
        removeCondition(idx) {
            this.copyUengineProperties.condition.splice(idx, 1)
            this.$emit('update:uengineProperties', this.copyUengineProperties)
        },
        editCondition(idx) {
            this.copyUengineProperties.condition[idx].condition.key = "test"
            this.$emit('update:uengineProperties', this.copyUengineProperties)
        }
    }
};
</script>
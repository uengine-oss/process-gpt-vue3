<template>
    <div>
        <div>{{ $t('BpnmPropertyPanel.condition') }}</div>
        <div>
            <ConditionField :value="copyUengineProperties.condition"
                @update:value="updateCondition"
            />
            <!-- {{ copyUengineProperties.condition }} -->
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
import ConditionField from './ConditionField.vue';

const storage = StorageBaseFactory.getStorage()
export default {
    name: 'sequence-flow-panel',
    components: {
        ConditionField,
    },
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean,
        name: String,
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
        
        if (!this.copyUengineProperties.condition) {
            this.copyUengineProperties.condition = [{
                _type: "org.uengine.kernel.Evaluate",
                conditionsVt: [],
                expression: {
                    key: '',
                    value: '',
                    comparator: '',
                },
            }];
        }
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
        // addCondition() {
        //     let condition = {
        //         "condition": {
        //             "_type": "org.uengine.kernel.Evaluate",
        //             "key": "troubleType",
        //             "value": "sw"
        //         }
        //     }
        //     this.copyUengineProperties.condition.push(condition)
        //     this.$emit('update:uengineProperties', this.copyUengineProperties)
        // },
        // removeCondition(idx) {
        //     this.copyUengineProperties.condition.splice(idx, 1)
        //     this.$emit('update:uengineProperties', this.copyUengineProperties)
        // },
        // editCondition(idx) {
        //     this.copyUengineProperties.condition[idx].condition.key = "test"
        //     this.$emit('update:uengineProperties', this.copyUengineProperties)
        // },
        updateCondition(condition) {
            this.copyUengineProperties.condition = condition;
            this.$emit('update:uengineProperties', this.copyUengineProperties)
        },
        beforeSave() {
            if (!this.name || this.name == '') {
                if (this.copyUengineProperties.condition.length > 0) {
                    var expression;
                    if (this.copyUengineProperties.condition[0].expression) {
                        expression = this.copyUengineProperties.condition[0].expression;
                    } else {
                        expression = this.copyUengineProperties.condition[0].conditionsVt[0].expression;
                    }
                    const name = expression.key + " " + expression.comparator + " " + expression.value;
                    this.$emit('update:name', name);
                }
            }
        }
    }
};
</script>
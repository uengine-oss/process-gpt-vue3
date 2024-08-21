<template>
    <div>
        <div>{{ $t('BpmnPropertyPanel.condition') }}</div>
        <div>
            <ConditionField :value="copyUengineProperties.condition"
                @update:value="updateCondition"
            />
            <!-- {{ copyUengineProperties.condition }} -->
        </div>
        <br>
        <div>{{ $t('BpmnPropertyPanel.priority') }}</div>
        <div>
            <v-text-field 
                v-model="copyUengineProperties.priority" 
                :disabled="isViewMode" 
                ref="cursor"
                @input="updatePriority($event.target.value)"
            ></v-text-field>
        </div>
        <!-- <v-text-field v-model="condition.key" />
        <v-text-field v-model="condition.value" /> -->
        <!-- <v-btn @click="addCondition">조건 추가</v-btn> -->
    </div>
</template>
<script>
import { useBpmnStore } from '@/stores/bpmn';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
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
        updatePriority(priority) {
            if(priority && priority.length > 0) {
                this.copyUengineProperties.priority = priority;
                this.$emit('update:uengineProperties', this.copyUengineProperties)
            }else {
                delete this.copyUengineProperties.priority;
            }
        },
        beforeSave() {
            var expression = this.copyUengineProperties.condition;
            if(expression.key == '' && expression.value == '' && expression.condition == '') {
                delete this.copyUengineProperties.condition;
                this.$emit('update:uengineProperties', this.copyUengineProperties)
                return;
            }
            if (!this.name || this.name == '') {
                let name = 'condition'
                if (this.copyUengineProperties.condition.conditionsVt) {
                    name = 'multiCondition';
                } else if (this.copyUengineProperties.condition.condition) {
                    expression = this.copyUengineProperties.condition;
                    name = "NOT " + expression.condition.key + " " + expression.condition.condition + " " + expression.condition.value;
                } else {
                    expression = this.copyUengineProperties.condition;
                    name = expression.key + " " + expression.condition + " " + expression.value;
                }
                
                this.$emit('update:name', name);
            }
        }
    }
};
</script>
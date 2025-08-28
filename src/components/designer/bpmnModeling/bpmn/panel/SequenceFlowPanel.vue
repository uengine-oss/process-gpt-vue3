<template>
    <div>
        <div class="mb-1 mt-4">{{ $t('BpmnPropertyPanel.condition') }}</div>
        <div v-if="mode == 'ProcessGPT'">
            <TextConditionField :value="copyUengineProperties.condition"
                @update:value="updateCondition"
            />
            <ConditionExampleField 
                :value="copyUengineProperties.examples" 
                :processDefinitionId="processDefinitionId"
                :condition="copyUengineProperties.condition"
                :element="element"
                @update:value="updateExamples"
            />
        </div>
        <div v-else>
            <ConditionField :value="copyUengineProperties.condition"
                @update:value="updateCondition"
            />
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
import ConditionField from './ConditionField.vue';
import TextConditionField from './TextConditionField.vue';
import ConditionExampleField from './ConditionExampleField.vue';

export default {
    name: 'sequence-flow-panel',
    components: {
        ConditionField,
        TextConditionField,
        ConditionExampleField,
    },
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean,
        name: String,
        element: Object
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
            if (this.mode == 'ProcessGPT') {
                this.copyUengineProperties.condition = '';
            } else {
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
        }
    },
    computed: {
        mode() {
            return window.$mode;
        }
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
        updateExamples(examples) {
            this.copyUengineProperties.examples = examples;
            this.$emit('update:uengineProperties', this.copyUengineProperties)
        },
        beforeSave() {
            var expression = this.copyUengineProperties.condition;
            if((this.mode == 'ProcessGPT' && expression == '') || (this.mode != 'ProcessGPT' && expression.key == '' && expression.value == '' && expression.condition == '')) {
                delete this.copyUengineProperties.condition;
                this.$emit('update:uengineProperties', this.copyUengineProperties)
                return;
            }
            
            if (!this.name || this.name == '') {
                if (this.mode !== 'ProcessGPT') {
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
                }
                
                this.$emit('update:name', name);
            }
        }
    }
};
</script>
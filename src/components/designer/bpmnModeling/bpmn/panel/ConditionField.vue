<template>
    <div>
        <draggable class="list-group cursor-pointer" :list="condition" :animation="0" ghost-class="ghost-card" group="condition">
            <template v-for="(item, idx) in getConditions(condition)" :key="idx">
                <div v-if="checkCondition(item)" class="d-flex condition-box mt-2">
                    <v-combobox
                        :label="item.key"
                        v-model="item.key"
                        :items="varItems"
                        variant="outlined"
                        density="comfortable"
                        style="max-width: 120px;"
                    ></v-combobox>

                    <v-select
                        :label="item.condition"
                        v-model="item.condition"
                        :items="conditionList"
                        class="mx-1"
                        style="max-width: 100px;"
                    ></v-select>

                    <v-combobox
                        :label="item.value"
                        v-model="item.value"
                        :items="varItems"
                        variant="outlined"
                        density="comfortable"
                        style="max-width: 120px;"
                    ></v-combobox>

                    <div class="mt-1">
                        <v-btn icon variant="text"
                            density="comfortable"
                            class="ml-1"
                        >
                            <DotsVerticalIcon />
                            <v-menu activator="parent">
                                <v-list>
                                    <v-list-item v-for="menu in menuList" :key="menu" @click="changeCondition(item, menu)">
                                        <v-list-item-title>{{ menu }}</v-list-item-title>
                                    </v-list-item>
                                </v-list>
                            </v-menu>
                        </v-btn>

                        <v-btn v-if="idx == getConditions(condition).length - 1" icon variant="text" @click="addCondition(item)"
                            density="comfortable"
                            class="ml-1"
                        >
                            <v-icon>mdi-plus</v-icon>
                        </v-btn>
                        <v-btn v-if="getConditions(condition).length > 1" icon variant="text" @click="deleteCondition(item, idx)"
                            density="comfortable"    
                            class="ml-1"
                        >
                            <Icons :icon="'trash'" />
                        </v-btn>
                    </div>
                </div>
                <div v-else class="pa-3 border" style="border-radius:8px;">
                    <div class="d-flex">
                        <v-chip>
                            {{ getTypeShortName(item._type) }}
                        </v-chip>
                        <v-btn icon variant="text" class="ml-auto" @click="deleteCondition(item, idx)"
                            density="comfortable"
                        >
                            <Icons :icon="'trash'" />
                        </v-btn>
                    </div>
                    <ConditionField :value="item.conditionsVt ? item.conditionsVt : item.condition" @update:value="(val) => updateChild(item, val)" />
                </div>
            </template>
        </draggable>
    </div>
</template>

<script>
import { useBpmnStore } from '@/stores/bpmn';

export default {
    name: 'ConditionField',
    props: {
        value: Object
    },
    data() {
        return {
            condition: {},
            varItems: [],
            conditionList: ['==', '!=', '>', '>=', '<', '<='],
            menuList: ['AND', 'OR', 'NOT'],
            modeler: null
        };
    },
    watch: {
        condition: {
            deep: true,
            handler(val) {
                console.log(val);
                this.$emit('update:value', val);
            }
        }
    },
    async created() {
        if (this.value) {
            this.condition = this.value;
        } else {
            this.condition = {
                _type: 'org.uengine.kernel.Evaluate',
                key: '',
                value: '',
                condition: ''
            };
        }
    },
    mounted() {
        const bpmnStore = useBpmnStore();
        const modeler = bpmnStore.getModeler;
        const def = modeler.getDefinitions();
        console.log(def);
        def.rootElements.forEach((ele) => {
            if (ele.$type == 'bpmn:Process') {
                ele.extensionElements?.values?.forEach((props) => {
                    if (props.$type == 'uengine:Properties') {
                        props.variables?.forEach((val) => {
                            this.varItems.push(val.$attrs.name);
                        });
                    }
                });
            }
        });
    },
    methods: {
        updateChild(item, val) {
            //
            if(item._type == 'org.uengine.kernel.Not')
            item.condition = val
        },
        changeCondition(item, type) {
            const child = JSON.parse(JSON.stringify(item));
            if (type == 'AND') {
                item.conditionsVt = [];
                item.conditionsVt.push(child);
                item._type = 'org.uengine.kernel.And';
                item.conditionsVt.push({
                    _type: 'org.uengine.kernel.Evaluate',
                    key: '',
                    value: '',
                    condition: ''
                });
                delete item.key;
                delete item.value;
                delete item.condition;
            } else if (type == 'OR') {
                item.conditionsVt = [];
                item.conditionsVt.push(child);
                item._type = 'org.uengine.kernel.Or';
                item.conditionsVt.push({
                    _type: 'org.uengine.kernel.Evaluate',
                    key: '',
                    value: '',
                    condition: ''
                });
                delete item.key;
                delete item.value;
                delete item.condition;
            } else if (type == 'NOT') {
                item._type = 'org.uengine.kernel.Not';
                delete item.key;
                delete item.value;
                delete item.condition;
            }
        },
        deleteCondition(item, idx) {
            if (Array.isArray(this.condition)) {
                this.condition.splice(idx, 1);
                if (this.condition.length == 0) {
                    this.condition = {
                        _type: 'org.uengine.kernel.Evaluate',
                        key: '',
                        value: '',
                        condition: ''
                    };
                }
            } else {
                this.condition = {
                    _type: 'org.uengine.kernel.Evaluate',
                    key: '',
                    value: '',
                    condition: ''
                };
            }
        },
        addCondition(item) {
            if (Array.isArray(this.condition)) {
                this.condition.push({
                    _type: 'org.uengine.kernel.Evaluate',
                    key: '',
                    value: '',
                    condition: ''
                });
            } else {
                this.changeCondition(item, 'AND');
            }
        },
        checkCondition(item) {
            const condition = item._type.includes('Evaluate');
            return condition;
        },
        getConditions(item) {
            var result = [];
            if (Array.isArray(item)) {
                result = item;
            } else {
                result.push(item);
            }
            return result;
        },
        getTypeShortName(type) {
            const parts = type.split('.');
            return parts[parts.length - 1];
        },
    }
};
</script>

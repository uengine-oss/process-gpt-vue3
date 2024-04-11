<template>
    <div>
        <draggable class="list-group cursor-pointer" :list="condition" :animation="0" ghost-class="ghost-card"
            group="condition">
            <template v-for="(item, idx) in condition" :key="idx">
                <div v-if="item._type.includes('Evaluate')" class="d-flex">
                    <v-combobox v-model="item.expression.key" :items="varItems" variant="outlined"
                        style="max-width: 100px; overflow-x: hidden;"></v-combobox>

                    <v-select v-model="item.expression.comparator" :items="comparatorList" class="mx-1"
                        style="max-width: 100px; overflow-x: hidden;"></v-select>

                    <v-combobox v-model="item.expression.value" :items="varItems" variant="outlined"
                        style="max-width: 100px; overflow-x: hidden;"></v-combobox>

                    <v-btn icon variant="text">
                        <DotsVerticalIcon />
                        <v-menu activator="parent">
                            <v-list>
                                <v-list-item v-for="menu in menuList" :key="menu" @click="changeCondition(item, menu)">
                                    <v-list-item-title>{{ menu }}</v-list-item-title>
                                </v-list-item>
                            </v-list>
                        </v-menu>
                    </v-btn>

                    <v-btn icon variant="text" @click="deleteCondition(condition, idx)">
                        <v-icon>mdi-delete-outline</v-icon>
                    </v-btn>
                </div>
                <div v-else class="pa-3 border">
                    <div class="d-flex">
                        <v-chip>
                            {{ item._type }}
                        </v-chip>
                        <v-btn icon variant="text" class="ml-auto" @click="deleteCondition(condition, idx)">
                            <v-icon>mdi-delete-outline</v-icon>
                        </v-btn>
                    </div>
                    <ConditionField :value="item.conditionsVt" />
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
        value: Array,
    },
    data() {
        return {
            condition: [],
            varItems: [],
            comparatorList: [
                '==',
                '!=',
                '>',
                '>=',
                '<',
                '<=',
            ],
            menuList: ["AND", "OR", "NOT"],
            modeler: null
        };
    },
    watch: {
        condition: {
            deep: true,
            handler(val) {
                this.$emit("update:value", val);
            },
        },
    },
    async created() {
        if (this.value && this.value.length > 0) {
            this.condition = this.value;
        } else {
            this.condition = [{
                _type: 'org.uengine.kernel.Evaluate',
                conditionsVt: [],
                expression: {
                    key: '',
                    value: '',
                    comparator: '',
                },
            }];
        }

        // const storage = StorageBaseFactory.getStorage();
        // const options = {
        //     match: {
        //         id: this.$route.params.id
        //     }
        // }

        // const process = await storage.getObject('proc_def', options);
        // if (process && process.definition && process.definition.data) {
        //     this.varItems = process.definition.data.map(item => item.name);
        // }
    },
    mounted() {
        const bpmnStore = useBpmnStore();
        const modeler = bpmnStore.getModeler;
        const def = modeler.getDefinitions()
        console.log(def)
        def.rootElements.forEach((ele) => {
            if (ele.$type == "bpmn:Process") {
                ele.extensionElements?.values?.forEach(props => {
                    if (props.$type == "uengine:Properties") {
                        props.variables?.forEach(val => {
                            this.varItems.push(val.$attrs.name)
                        })
                    }
                })
            }
        })
    },
    methods: {
        changeCondition(item, type) {
            const child = JSON.parse(JSON.stringify(item));

            if (!item.conditionsVt) {
                item.conditionsVt = [];
            }
            item.conditionsVt.push(child);
            delete item.expression;

            if (type == "AND") {
                item._type = 'org.uengine.kernel.AND';
                item.conditionsVt.push({
                    _type: 'org.uengine.kernel.Evaluate',
                    conditionsVt: [],
                    expression: {
                        key: '',
                        value: '',
                        comparator: '',
                    },
                });
            } else if (type == "OR") {
                item._type = 'org.uengine.kernel.OR';
                item.conditionsVt.push({
                    _type: 'org.uengine.kernel.Evaluate',
                    conditionsVt: [],
                    expression: {
                        key: '',
                        value: '',
                        comparator: '',
                    },
                });
            } else if (type == "NOT") {
                item._type = 'org.uengine.kernel.NOT';
            }
        },
        deleteCondition(list, idx) {
            list.splice(idx, 1);
            if (list.length == 0) {
                list.push({
                    _type: 'org.uengine.kernel.Evaluate',
                    conditionsVt: [],
                    expression: {
                        key: '',
                        value: '',
                        comparator: '',
                    },
                });
            }
        },
    }
}
</script>
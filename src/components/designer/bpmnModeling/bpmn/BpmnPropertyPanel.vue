<template>
    <div style="height: 95%; margin-top: 10px; overflow: auto;" v-click-outside="onClickOutside">
        <v-card-text>
            Name
            <v-text-field v-model="copyElement.name"></v-text-field>
            <div>
                Description
                <v-textarea v-if="!copyElement.$type.includes('Event')"
                    v-model="copyElement.extensionElements.values[0].description"></v-textarea>
            </div>
            <div v-if="element.$type.includes('Task') && inputData.length > 0">
                Input Data
                <v-row style="margin-top: 10px;">
                    <div v-for="(inputData, idx) in inputData" :key="idx">
                        <v-chip color="primary" class="text-body-2" v-if="inputData.mandatory">
                            {{ inputData.key }}
                            <CircleXIcon class="ml-2" start size="20" />
                        </v-chip>
                        <v-chip v-else class="text-body-2">
                            {{ inputData.key }}
                            <CircleXIcon class="ml-2" start size="20" />
                        </v-chip>
                    </div>
                </v-row>
            </div>
            <div v-if="element.$type.includes('Task') && outputData.length > 0">
                Output Data
                <v-row style="margin-top: 10px;">
                    <div v-for="(output, idx) in outputData" :key="idx">
                        <v-chip color="primary" class="text-body-2" v-if="output.mandatory">
                            {{ output.key }}
                            <CircleXIcon class="ml-2" start size="20" />
                        </v-chip>
                        <v-chip v-else class="text-body-2">
                            {{ output.key }}
                            <CircleXIcon class="ml-2" start size="20" />
                        </v-chip>
                    </div>
                </v-row>
            </div>
            <div v-if="element.$type == 'bpmn:SciptTask'">
                Script
                <v-textarea></v-textarea>
            </div>
            <div v-if="element.$type.includes('Flow')">
                Condition
                <br />
                {{ copyElement?.extensionElements?.values?.[0]?.$children?.[0].$children?.[0].$body }}
                <v-text-field v-model="fromVar"></v-text-field>
                <v-select :items="conditionItem" v-model="condition"></v-select>
                <v-text-field v-model="toVar"></v-text-field>
            </div>
            <!-- "condition": "total_vacation_days_remains > total_vacation_days" -->

        </v-card-text>

    </div>
</template>
<script>
import { MoodSmileIcon, CircleXIcon } from 'vue-tabler-icons';
export default {
    name: 'bpmn-property-panel',
    props: {
        element: Object
    },
    data() {
        return {
            copyElement: this.element,
            conditionItem: [">", "==", "<"],
            fromVar: "",
            condition: "",
            toVar: ""
        };
    },
    mounted() {
        if (this.element.$type.includes('Flow')) {
            let split = this.element?.extensionElements?.values?.[0]?.$children?.[0].$children?.[0].$body.split(" ");
            this.fromVar = split[0]
            this.condition = split[1]
            this.toVar = split[2]
        }
    },
    computed: {
        inputData() {
            let params = this.copyElement?.extensionElements?.values?.[0]?.$children?.[0]?.$children
            let result = []
            params.forEach(element => {
                if (element.category == 'input')
                    result.push(element)
            });
            return result
        },
        outputData() {
            let params = this.copyElement?.extensionElements?.values?.[0]?.$children?.[0]?.$children
            let result = []
            params.forEach(element => {
                if (element.category == 'output')
                    result.push(element)
            });
            return result
        }
    },
    watch: {
        copyElement: {
            deep: true,
            handler(val) {
                console.log(val);
            }
        },
        fromVar: {
            deep: true,
            handler(newVal) {
                console.log(newVal)
                let str = newVal + " " + this.condition + " " + this.toVar
                this.copyElement.extensionElements.values[0].$children[0].$children[0].$body = str;
            }
        },
        condition: {
            handler(newVal) {
                let str = this.fromVar + " " + newVal + " " + this.toVar
                this.copyElement.extensionElements.values[0].$children[0].$children[0].$body = str;
            }
        },
        toVar: {
            handler(newVal) {
                let str = this.fromVar + " " + this.condition + " " + newVal
                this.copyElement.extensionElements.values[0].$children[0].$children[0].$body = str;
            }
        }
    },
    methods: {
        onClickOutside() {
            this.$emit('updateElement', this.copyElement)
            this.$emit('close');
            console.log(this.copyElement);
        },

    }
};
</script>
<!-- 이하 패널 기존 코드
<template>

</template>

<script>
    import BpmnVueFinder from './BpmnVueFinder.vue'
    import BpmnComponentFinder from './BpmnComponentFinder.vue'
    import ModelPanel from "../../modeling/ModelPanel.vue"
    import * as jsondiff from 'jsondiffpatch'
    var jsondiffpatch = jsondiff.create({
        objectHash: function (obj, index) {
            return '$$index:' + index;
        },
    });

    export default {
        mixins: [BpmnVueFinder, BpmnComponentFinder, ModelPanel],
        name: 'bpmn-property-panel',
        props: {
            widthStyle: {
                type: String,
            default: function () {
                    return 'width: 500px;'
                }
            },
        },
        computed: {},
        data() {
            return {
                modelCanvasComponent: null,
                namePanel: '',
            }
        },
        created: function () {},
        beforeDestroy() {
            var me = this
            me.executeBeforeDestroy()
        },
        watch: {
            //모델러에 의해 tracingTag 가 변경되었을 경우.
            // "value.tracingTag": function (value) {
            //     var me = this;
            //     //이미 있음.
            //     if (me.canvas.checkExistTracingTag(value)) {
            //         console.log('TracingTag aleardy exist.');
            //     }
            //     //트레이싱 태그 값이 바뀜.
            //     else if (value && value.length > 0) {
            //         var oldTracingTag = me.value.tracingTag;

            //         //해당 액티비티 업데이트.
            //         me.value.tracingTag = value;
            //         me.$emit('update:item', me.value);

            //         //해당 트레이싱 태그를 사용중인 릴레이션의 source,target 을 변경한다.
            //         // var sequenceFlows = me.canvas.data.definition.sequenceFlows;
            //         // if (sequenceFlows && sequenceFlows.length) {
            //         //     $.each(sequenceFlows, function (i, relation) {
            //         //         if (relation.sourceRef == oldTracingTag) {
            //         //             relation.sourceRef = value;
            //         //         }
            //         //         if (relation.targetRef == oldTracingTag) {
            //         //             relation.targetRef = value;
            //         //         }
            //         //     });
            //         // }
            //     }
            // },
        },
        methods: {
            setElementCanvas(){
                var me = this
                me.modelCanvasComponent = me.$parent.getComponent('bpmn-modeling-canvas')
                me.canvas = me.$parent.getComponent('bpmn-modeling-canvas')
            },
            closePanel() {
                this.navigationDrawer = false;
                this.$emit('close');
            },
            executeBeforeDestroy() {
                var me = this
                try{
                    /*
                        _value : 기존 값.
                        value  : Panel 사용되는 값,
                    */
                    console.log(me._value)
                    console.log(me.value)
                    var diff = jsondiffpatch.diff(me._value, me.value)
                    if (diff && Object.keys(diff).length > 0) {
                        if (!me.readOnly) {
                            me.canvas.changedByMe = true

                            // part sync
                            me._value.oldName = JSON.parse(JSON.stringify(me._value.name))

                            // all sync
                            Object.keys(me.value).forEach(function (itemKey) {
                                if(!(itemKey == 'elementView' || itemKey == 'relationView')){
                                    // Exception: 위치정보
                                    me._value[itemKey] = JSON.parse(JSON.stringify(me.value[itemKey]))
                                }
                            })
                            // re setting 값을 emit
                            me.$emit('_value-change', me._value)
                        }
                    }

                    if (me.canvas.isServerModel
                        && me.canvas.isQueueModel
                        && !me.isClazzModeling
                        && !me.canvas.isReadOnlyModel
                    ) {
                        me.panelCloseQueue()
                    }
                } catch (e) {
                  console.log(e)  
                }
            }
        }
    }
</script>


<style lang="scss" rel="stylesheet/scss">
    .md-sidenav.md-right .md-sidenav-content {
        width: 600px;
    }

</style>
 -->

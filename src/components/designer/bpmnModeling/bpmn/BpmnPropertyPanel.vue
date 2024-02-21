<template>
    <div style="height: 95%; margin-top: 10px; overflow: auto;" v-click-outside="onClickOutside">
        <v-card-text>
            Name
            <v-text-field v-model="name"></v-text-field>
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
                <v-text-field
                    v-model="copyElement.extensionElements.values[0].$children[0].$children[0].$body"></v-text-field>

            </div>
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
            name: ""
        };
    },
    mounted() {
        this.name = this.element.name
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
                // console.log(val);
            }
        }
    },
    methods: {
        onClickOutside() {
            this.copyElement.name = this.name
            this.$emit('updateElement', this.copyElement)
            this.$emit('close');
        },

    }
};
</script>
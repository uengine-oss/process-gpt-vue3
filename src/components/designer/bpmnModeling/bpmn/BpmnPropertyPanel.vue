<template>
    <div style="height: 95%; margin-top: 10px; overflow: auto;" v-click-outside="onClickOutside">
        <v-card-text>
            <div>Name</div>
            <v-text-field v-model="name"></v-text-field>
            <div>
                <div>Description</div>
                <v-textarea v-if="!copyElement.$type.includes('Event')"
                    v-model="copyElement.extensionElements.values[0].description"></v-textarea>
            </div>
            <div v-if="element.$type.includes('Task') && inputData.length > 0" style="margin-bottom:20px;">
                <div style="margin-bottom:-8px;">Input Data</div>
                <v-row class="ma-0 pa-0">
                    <div v-for="(inputData, idx) in inputData" :key="idx" class="mr-2 mt-2">
                        <v-chip v-if="inputData.mandatory" color="primary" variant="outlined" class="text-body-2">
                            {{ inputData.key }}
                            <CircleXIcon class="ml-2" start size="20" />
                        </v-chip>
                        <v-chip v-else class="text-body-2" variant="outlined">
                            {{ inputData.key }}
                            <CircleXIcon class="ml-2" start size="20" />
                        </v-chip>
                    </div>
                </v-row>
            </div>
            <div v-if="element.$type.includes('Task') && outputData.length > 0" style="margin-bottom:20px;">
                <div style="margin-bottom:-8px;">Output Data</div>
                <v-row class="ma-0 pa-0">
                    <div v-for="(output, idx) in outputData" :key="idx" class="mr-2 mt-2">
                        <v-chip v-if="output.mandatory" color="primary" class="text-body-2" variant="outlined">
                            {{ output.key }}
                            <CircleXIcon class="ml-2" start size="20" />
                        </v-chip>
                        <v-chip v-else class="text-body-2" variant="outlined">
                            {{ output.key }}
                            <CircleXIcon class="ml-2" start size="20" />
                        </v-chip>
                    </div>
                </v-row>
            </div>
            <div v-if="element.$type == 'bpmn:ScriptTask'">
                Script (Python)
                <v-textarea v-model="copyElement.extensionElements.values[0].pythonCode"></v-textarea>
            </div>
            <div v-if="element.$type.includes('Flow')">
                Condition
                <br />
                <v-text-field
                    v-model="copyElement.extensionElements.values[0].$children[0].$children[0].$body"></v-text-field>
            </div>
            <div v-if="element.$type.includes('Task')">
                <div>Checkpoints</div>
                <div v-for="(checkpoint, idx) in checkpoints" :key="idx">
                    <v-checkbox-btn color="success" :label="checkpoint.checkpoint" hide-details
                        v-model="checkbox"></v-checkbox-btn>
                </div>
                <v-text-field v-if="editCheckpoint" v-model="checkpointMessage.checkpoint"></v-text-field>
                <v-btn v-if="editCheckpoint" @click="addCheckpoint">
                    Submit
                </v-btn>
                <v-card @click="editCheckpoint = !editCheckpoint"
                    elevation="9" variant="outlined"
                    style="padding: 5px; display: flex; justify-content: center; align-items: center; border-radius: 10px !important;"
                >
                    <div style="display: flex; justify-content: center; align-items: center;">
                        <Icon icon="streamline:add-1-solid" width="20" height="20" style="color: #5EB2E8" />
                    </div>
                </v-card>
            </div>
        </v-card-text>

    </div>
</template>
<script>
import { UserIcon, PlusIcon, UsersIcon, PhotoIcon, StarIcon, FileDescriptionIcon, CreditCardIcon, KeyIcon } from 'vue-tabler-icons';
export default {
    name: 'bpmn-property-panel',
    props: {
        element: Object
    },
    data() {
        return {
            copyElement: this.element,
            name: "",
            checkpoints: [],
            editCheckpoint: false,
            checkpointMessage: {
                "$type": "uengine:checkpoint",
                "checkpoint": ""
            },
            code: ""
        };
    },
    mounted() {
        console.log(this.element)
        this.name = this.element.name
        this.checkpoints = this.element.extensionElements.values?.[0]?.$children?.[0]?.$children ? this.element.extensionElements.values[0].$children[0].$children : []

    },
    computed: {
        inputData() {
            let params = this.copyElement?.extensionElements?.values?.[0]?.$children?.[1]?.$children
            let result = []
            if (params)
                params.forEach(element => {
                    if (element.category == 'input')
                        result.push(element)
                });
            return result
        },
        outputData() {
            let params = this.copyElement?.extensionElements?.values?.[0]?.$children?.[1]?.$children
            let result = []
            if (params)
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
        addCheckpoint() {
            this.checkpoints.push(this.checkpointMessage)
            this.checkpointMessage = {
                "$type": "uengine:checkpoint",
                "checkpoint": ""
            };
        },
        onClickOutside() {
            this.copyElement.name = this.name
            this.copyElement.extensionElements.values[0].$children[0].$children = this.checkpoints
            this.$emit('updateElement', this.copyElement)
            this.$emit('close');
        },

    }
};
</script>
<template>
    <div>
        <div v-if="inputData.length > 0" style="margin-bottom: 20px">
            <div style="margin-bottom: -8px">{{ $t('BpnmPropertyPanel.inputData') }}</div>
            <v-row class="ma-0 pa-0">
                <div v-for="(inputData, idx) in inputData" :key="idx" class="mr-2 mt-2">
                    <v-chip
                        v-if="inputData.mandatory"
                        color="primary"
                        variant="outlined"
                        class="text-body-2"
                        @click="deleteInputData(inputData)"
                    >
                        {{ inputData.key }}
                        <CircleXIcon class="ml-2" start size="20" />
                    </v-chip>
                    <v-chip v-else class="text-body-2" variant="outlined" @click="deleteInputData(inputData)">
                        {{ inputData.key }}
                        <CircleXIcon class="ml-2" start size="20" />
                    </v-chip>
                </div>
            </v-row>
        </div>
        <div v-if="outputData.length > 0" style="margin-bottom: 20px">
            <div style="margin-bottom: -8px">{{ $t('BpnmPropertyPanel.outputData') }}</div>
            <v-row class="ma-0 pa-0">
                <div v-for="(output, idx) in outputData" :key="idx" class="mr-2 mt-2">
                    <v-chip
                        v-if="output.mandatory"
                        color="primary"
                        class="text-body-2"
                        variant="outlined"
                        @click="deleteOutputData(output)"
                    >
                        {{ output.variable.name }}
                        <CircleXIcon class="ml-2" start size="20" />
                    </v-chip>
                    <v-chip v-else class="text-body-2" variant="outlined" @click="deleteOutputData(output)">
                        {{ output.variable.name }}
                        <CircleXIcon class="ml-2" start size="20" />
                    </v-chip>
                </div>
            </v-row>
        </div>
        <div>
            <v-row class="ma-0 pa-0">
                <v-text-field v-model="copyUengineProperties.uriTemplate" label="호출 URI 패턴"></v-text-field>
            </v-row>
            <v-row class="ma-0 pa-0">
                <v-checkbox
                    v-if="copyUengineProperties.uriTemplate && copyUengineProperties.uriTemplate.indexOf('https://') == 0"
                    v-model="copyUengineProperties.noValidationForSSL"
                    label="Don't validate the certificate"
                ></v-checkbox>
            </v-row>
            <v-row class="ma-0 pa-0">
                <v-select
                    v-if="links"
                    v-model="copyUengineProperties.uriTemplate"
                    :items="links"
                    item-text="link.link"
                    item-value="link.href"
                    label="호출 서비스 선택"
                ></v-select>
            </v-row>
            <v-row class="ma-0 pa-0">
                <v-select v-model="copyUengineProperties.method" :items="methodList" label="호출 메서드"></v-select>
            </v-row>
            <v-row class="ma-0 pa-0">
                <v-textarea
                    v-if="'GET,DELETE'.indexOf(copyUengineProperties.method) == -1"
                    v-model="copyUengineProperties.inputPayloadTemplate"
                    label="입력 데이터 (JSON template)"
                    dense
                ></v-textarea>
            </v-row>

            <v-row class="ma-0 pa-0">
                <div>{{ $t('BpnmPropertyPanel.checkPoints') }}</div>
                <bpmn-parameter-contexts :parameter-contexts="copyUengineProperties.parameters"></bpmn-parameter-contexts>
            </v-row>
            <v-row class="ma-0 pa-0">
                <v-checkbox v-model="copyUengineProperties.skipIfNotFound" label="리소스 없을 경우 (404) 오류 처리 하지 않음"></v-checkbox>
            </v-row>
        </div>

        <!-- <div>
            <v-row class="ma-0 pa-0">
                <div>{{ $t('BpnmPropertyPanel.checkPoints') }}</div>
                <v-spacer></v-spacer>
                <v-icon v-if="editCheckpoint" @click="editCheckpoint = false" style="margin-top: 2px">mdi-close</v-icon>
            </v-row>
            <div v-for="(checkpoint, idx) in copyUengineProperties.checkpoints" :key="idx">
                <div>
                    <v-checkbox-btn
                        color="success"
                        :disabled="isViewMode"
                        :label="checkpoint.checkpoint"
                        hide-details
                        v-model="checkbox"
                    ></v-checkbox-btn>
                </div>
                <v-btn icon flat @click="deleteCheckPoint(checkpoint)" v-if="!isViewMode" v-bind="props">
                    <TrashIcon stroke-width="1.5" size="20" class="text-error" />
                </v-btn>
            </div>
            <v-text-field v-if="editCheckpoint" v-model="checkpointMessage.checkpoint" :disabled="isViewMode"></v-text-field>
            <v-row class="ma-0 pa-0" v-if="!isViewMode">
                <v-spacer></v-spacer>
                <v-btn v-if="editCheckpoint" @click="addCheckpoint" color="primary" rounded="pill" size="small">{{
                    $t('BpnmPropertyPanel.add')
                }}</v-btn>
                <v-card
                    v-else
                    @click="editCheckpoint = !editCheckpoint"
                    elevation="9"
                    variant="outlined"
                    style="padding: 5px; display: flex; justify-content: center; align-items: center; border-radius: 10px !important"
                >
                    <div style="display: flex; justify-content: center; align-items: center">
                        <Icon icon="streamline:add-1-solid" width="20" height="20" style="color: #5eb2e8" />
                    </div>
                </v-card>
            </v-row>
        </div>
        <div>
            <v-row class="ma-0 pa-0">
                <div>Extended Property</div>
            </v-row>
            <v-row class="ma-0 pa-0">
                <v-table>
                    <thead>
                        <tr>
                            <th class="text-h6">Key</th>
                            <th class="text-h6">Value</th>
                            <th class="text-h6">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="param in copyUengineProperties.extendedProperties" :key="param.key" class="month-item">
                            <td>
                                {{ param.key }}
                            </td>
                            <td>
                                {{ param.value }}
                            </td>
                            <td>
                                <v-btn icon flat @click="deleteExtendedProperty(param)" v-bind="props">
                                    <TrashIcon stroke-width="1.5" size="20" class="text-error" />
                                </v-btn>
                            </td>
                        </tr>
                    </tbody>
                </v-table>
                <v-btn v-if="!isViewMode" flat color="primary" @click="editParam = !editParam">add Key/Value</v-btn>

                <v-card v-if="editParam" style="margin-top: 12px">
                    <v-card-title>Add Parameter</v-card-title>
                    <v-card-text>
                        <v-text-field v-model="paramKey" label="Key"></v-text-field>
                        <v-text-field v-model="paramValue" label="Value"></v-text-field>
                    </v-card-text>
                    <v-card-actions>
                        <v-btn @click="addParameter">add</v-btn>
                        <v-btn @click="editParam = !editParam">cancel</v-btn>
                    </v-card-actions>
                </v-card>
            </v-row>
        </div> -->
    </div>
</template>
<script>
import { useBpmnStore } from '@/stores/bpmn';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import { Icon } from '@iconify/vue';
const storage = StorageBaseFactory.getStorage();
export default {
    name: 'service-task-panel',
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean
    },
    created() {},
    data() {
        return {
            requiredKeyLists: {
                parameters: [],
                checkpoints: []
            },
            methodList: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
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
            links: ['/* 기존 eureka 서비스 목록 */']
        };
    },
    async mounted() {
        let me = this;

        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;
    },
    computed: {
        inputData() {
            let params = this.copyUengineProperties.parameters;
            let result = [];
            if (params)
                params.forEach((element) => {
                    if (element.direction == 'IN') result.push(element);
                });
            return result;
        },
        outputData() {
            let params = this.copyUengineProperties.parameters;
            let result = [];
            if (params)
                params.forEach((element) => {
                    if (element.direction == 'OUT') result.push(element);
                });
            return result;
        }
    },
    watch: {},
    methods: {
        deleteInputData(inputData) {
            const index = this.copyUengineProperties.parameters.findIndex((element) => element.key === inputData.key);
            if (index > -1) {
                this.copyUengineProperties.parameters.splice(index, 1);
                this.$emit('update:uEngineProperties', this.copyUengineProperties);
            }
        },
        deleteOutputData(outputData) {
            const index = this.copyUengineProperties.parameters.findIndex((element) => element.key === outputData.key);
            if (index > -1) {
                this.copyUengineProperties.parameters.splice(index, 1);
                this.$emit('update:uEngineProperties', this.copyUengineProperties);
            }
        },
        ensureKeyExists(obj, key, defaultValue) {
            if (!obj.hasOwnProperty(key)) {
                obj[key] = defaultValue;
            }
        },
        deleteExtendedProperty(item) {
            const index = this.copyUengineProperties.extendedProperties.findIndex((element) => element.key === item.key);
            if (index > -1) {
                this.copyUengineProperties.extendedProperties.splice(index, 1);
                this.$emit('update:uEngineProperties', this.copyUengineProperties);
            }
        },
        deleteCheckPoint(item) {
            const index = this.copyUengineProperties.checkpoints.findIndex((element) => element.checkpoint === item.checkpoint);
            if (index > -1) {
                this.copyUengineProperties.checkpoints.splice(index, 1);
                this.$emit('update:uEngineProperties', this.copyUengineProperties);
            }
        },
        addParameter() {
            this.copyUengineProperties.extendedProperties.push({ key: this.paramKey, value: this.paramValue });
            this.$emit('update:uEngineProperties', this.copyUengineProperties);
            // const bpmnFactory = this.bpmnModeler.get('bpmnFactory');
            // // this.checkpoints.push(this.checkpointMessage)
            // const parameter = bpmnFactory.create('uengine:ExtendedProperty', { key: this.paramKey, value: this.paramValue });
            // if (!this.elementCopy.extensionElements.values[0].ExtendedProperties) this.elementCopy.extensionElements.values[0].ExtendedProperties = []
            // this.elementCopy.extensionElements.values[0].ExtendedProperties.push(parameter)
            // this.paramKey = ""
            // this.paramValue = ""
        },
        async getData(path, options) {
            // let value;
            // if (path) {
            //     value = await this.storage.getObject(`db://${path}`, options);
            // } else {
            //     value = await this.storage.getObject(`db://${this.path}`, options);
            // }
            // return value;
        },
        addCheckpoint() {
            this.copyUengineProperties.checkpoints.push({ checkpoint: this.checkpointMessage.checkpoint });
            this.$emit('update:uEngineProperties', this.copyUengineProperties);
        }
    }
};
</script>

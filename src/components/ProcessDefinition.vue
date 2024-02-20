<template>
    <div>
        <v-row style="height: 100%" class="ma-0">
            <v-col class="d-flex ma-0 pa-0">
                <v-card elevation="1" style="border-radius: 0px !important;">
                    <v-tooltip :text="$t('processDefinition.processVariables')">
                        <template v-slot:activator="{ props }">
                            <v-btn @click="openProcessVariables" icon v-bind="props"
                                style="margin:10px 0px -10px 20px;"
                            >
                                <Icon icon="tabler:variable" width="32" height="32" />
                            </v-btn>
                        </template>
                    </v-tooltip>
                    <vue-bpmn :bpmn="bpmn" :options="options" v-on:error="handleError" v-on:shown="handleShown"
                        v-on:loading="handleLoading" v-on:openPanel="(id) => openPanel(id)"
                        v-on:definition="(def) => (definitions = def)"></vue-bpmn>
                </v-card>
            </v-col>
            <v-col v-if="panel" cols="12" sm="12" lg="4" md="6" class="d-flex">
                <v-card elevation="1">
                    <bpmn-property-panel :element="element" @close="closePanel"
                        v-on:updateElement="(val) => updateElement(val)"></bpmn-property-panel>
                    <!-- {{ definition }} -->
                </v-card>
            </v-col>
        </v-row>
        <v-dialog v-model="isViewProcessVariables" max-width="1000">
            <v-card>
                <v-card-title class="ma-0 pa-0" style="padding: 15px 0px 0px 25px !important;">{{ $t('processDefinition.editProcessData') }}</v-card-title>
                <v-btn icon style="position:absolute; right:5px; top:5px;" @click="isViewProcessVariables = false">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
                <v-card-text style="height: 1000px; width: 1000px;">
                    <VDataTable class="border rounded-md"
                        :items-per-page="5"
                        :items-per-page-text="$t('processDefinition.itemsPerPage')"
                    >
                        <thead>
                            <tr>
                                <th class="text-subtitle-1 font-weight-semibold">{{ $t('processDefinition.name') }}</th>
                                <th class="text-subtitle-1 font-weight-semibold">{{ $t('processDefinition.type') }}</th>
                                <th class="text-subtitle-1 font-weight-semibold">{{ $t('processDefinition.description') }}</th>
                                <th class="text-subtitle-1 font-weight-semibold">{{ $t('processDefinition.dataSource') }}</th>
                                <th class="text-subtitle-1 font-weight-semibold">{{ $t('processDefinition.query') }}</th>
                                <th class="text-subtitle-1 font-weight-semibold">{{ $t('processDefinition.actions') }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="item in copyProcessDefinition.data" :key="item.name">
                                <td class="text-subtitle-1">{{ item.name }}</td>
                                <td>
                                    {{ item.type }}
                                </td>
                                <td class="text-subtitle-1">{{ item.description }}</td>
                                <td class="text-subtitle-1">{{
                                    item.datasource ? item.datasource.type : 'None' }}</td>
                                <td>
                                    {{ item.datasource ? item.datasource.query : 'None' }}
                                </td>
                                <td>
                                    <div class="d-flex align-center">
                                        <v-tooltip :text="$t('processDefinition.edit')">
                                            <template v-slot:activator="{ props }">
                                                <v-btn icon flat @click="editItem(item)" v-bind="props">
                                                    <PencilIcon stroke-width="1.5" size="20" class="text-primary" />
                                                </v-btn>
                                            </template>
                                        </v-tooltip>
                                        <v-tooltip :text="$t('processDefinition.delete')">
                                            <template v-slot:activator="{ props }">
                                                <v-btn icon flat @click="deleteItem(item)" v-bind="props">
                                                    <TrashIcon stroke-width="1.5" size="20" class="text-error" />
                                                </v-btn>
                                            </template>
                                        </v-tooltip>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </VDataTable>
                    <v-row class="ma-0" style="margin:10px 0px 10px 0px !important;">
                        <v-card @click="addProcessVaribles"
                            elevation="9"
                            variant="outlined"
                            style="padding: 10px; display: flex; justify-content: center; align-items: center; border-radius: 10px !important;"
                        >
                            <div style="display: flex; justify-content: center; align-items: center;">
                                <Icon icon="streamline:add-1-solid" width="24" height="24" style="color: #5EB2E8" />
                            </div>
                        </v-card>
                    </v-row>
                    <div v-if="processVariblesWindow">
                        <v-card variant="outlined">
                            <v-card-text class="ma-0 pa-0">
                                <process-variable mode="add"
                                    @add-variables="val => copyProcessDefinition.data.push(val)"
                                ></process-variable>
                            </v-card-text>
                        </v-card>
                    </div>
                    <div v-if="editDialog">
                        <v-card variant="outlined">
                            <v-card-text class="ma-0 pa-0">
                                <process-variable :key="editComponentKey" :variable="editedItem" mode="edit"
                                    @update-variables="val => updateVariable(val)"
                                ></process-variable>
                            </v-card-text>
                        </v-card>
                    </div>
                </v-card-text>
            </v-card>
        </v-dialog>

        <!-- <v-dialog v-model="editDialog" max-width="1000">
            <v-card>
                <v-card-text class="px-4">
                    <process-variable :variable="editedItem" mode="edit"
                        @update-variables="val => updateVariable(val)"></process-variable>
                </v-card-text>
            </v-card>
        </v-dialog> -->

        <!-- <v-navigation-drawer permanent location="right" :width="400"> {{ panelId }} </v-navigation-drawer> -->
    </div>
</template>

<script>
import partialParse from 'partial-json-parser';
import { VectorStorage } from 'vector-storage';
import VueBpmn from './Bpmn.vue';
import BpmnPropertyPanel from './designer/bpmnModeling/bpmn/BpmnPropertyPanel.vue';
import ProcessVariable from './designer/bpmnModeling/bpmn/mapper/ProcessVariable.vue';
import { Icon } from '@iconify/vue';
import customBpmnModule from './customBpmn';
import { VDataTable } from 'vuetify/labs/VDataTable'



export default {
    name: 'ProcessDefinition',
    components: {
        VueBpmn,
        BpmnPropertyPanel,
        ProcessVariable,
        Icon,
        VDataTable
    },
    props: {
        processDefinition: Object,
        bpmn: String
    },
    data: () => ({
        panel: false,
        panelId: null,
        options: {
            propertiesPanel: {},
            additionalModules: [customBpmnModule],
            moddleExtensions: []
        },
        // headers: [{ title: 'Name', align: 'start', key: 'name', sortable: false, },
        // { title: 'Type', align: 'start', key: 'type' },
        // { title: 'Description', align: 'start', key: 'description' },
        // { title: 'DataSource', align: 'start', key: 'datasource' }],
        element: null,
        definitions: null,
        isViewProcessVariables: false,
        copyProcessDefinition: null,
        processVariblesWindow: false,
        editDialog: false,
        editedIndex: null,
        editedItem: null,
        lastEditedIndex: 0,
        editComponentKey: 0,
    }),
    computed() {
    },
    watch: {
        copyProcessDefinition: {
            deep: true,
            handler(newVal) {
                this.$emit("updateDefinition", this.copyProcessDefinition)
            }
        }
    },
    created() { },
    mounted() {
        this.copyProcessDefinition = this.processDefinition
    },
    methods: {
        editItem(item) {
            this.editedIndex = this.copyProcessDefinition.data.indexOf(item);
            this.editedItem = Object.assign({}, item);
            
            if(this.processVariblesWindow == true) {
                this.processVariblesWindow = false;
            }
            this.editComponentKey ^= 1; // ProcessVariable 컴포넌트 새로고침용 변수

            if(this.lastEditedIndex == this.editedIndex) {
                this.editDialog = !this.editDialog
            } else {
                this.editDialog = true
            }
            this.lastEditedIndex = this.editedIndex
        },
        deleteItem(item) {
            const index = this.copyProcessDefinition.data.indexOf(item);
            confirm('Are you sure you want to delete this item?') && this.copyProcessDefinition.data.splice(index, 1);
        },
        findElement(obj, key, id) {
            if (obj.hasOwnProperty(key) && obj[key] === id) {
                return obj;
            }

            for (let prop in obj) {
                if (obj[prop] instanceof Object) {
                    let result = this.findElement(obj[prop], key, id);
                    if (result) {
                        return result;
                    }
                }
            }

            return null;
        },
        updateVariable(val) {
            this.copyProcessDefinition.data[editedIndex] = val;
            this.editDialog = false
        },
        openProcessVariables() {
            this.isViewProcessVariables = !this.isViewProcessVariables
        },
        addProcessVaribles() {
            if(this.editDialog == true) {
                this.editDialog = false
            }
            this.processVariblesWindow = !this.processVariblesWindow
        },
        updateElement(element) {
            this.$emit('update')
        },
        openPanel(id) {
            this.panel = true;
            console.log(this.definitions);
            console.log(this.findElement(this.definitions, 'id', id));
            // console.log(JSON.stringify(this.findElement('id', id)));
            this.element = this.findElement(this.definitions, 'id', id);
        },
        closePanel() {
            this.element = null;
            this.panel = false;
        },
        handleError() {
            console.error('failed to show diagram', err);
        },
        handleShown() {
            console.log('diagram shown');
        },
        handleLoading() {
            console.log('diagram loading');
        }
    }
};
</script>
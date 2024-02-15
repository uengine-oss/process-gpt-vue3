<template>
    <div>
        <v-row style="height: 100%" class="ma-0">
            <v-col class="d-flex ma-0 pa-0">
                <v-card elevation="1" style="border-radius: 0px !important;">
                    <v-btn @click="openProcessVariables" variant="text">Process
                        Variables</v-btn>
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
                <v-card-text style="height: 1000px; width: 1000px">
                    <v-data-table items-per-page="5" class="border rounded-md">
                        <thead>
                            <tr>
                                <th class="text-subtitle-1 font-weight-semibold">Name</th>
                                <th class="text-subtitle-1 font-weight-semibold">Type</th>
                                <th class="text-subtitle-1 font-weight-semibold">Description</th>
                                <th class="text-subtitle-1 font-weight-semibold">DataSource</th>
                                <th class="text-subtitle-1 font-weight-semibold">Query</th>
                                <th class="text-subtitle-1 font-weight-semibold">Actions</th>
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
                                        <v-tooltip text="Edit">
                                            <template v-slot:activator="{ props }">
                                                <v-btn icon flat @click="editItem(item)" v-bind="props">
                                                    <PencilIcon stroke-width="1.5" size="20" class="text-primary" />
                                                </v-btn>
                                            </template>
                                        </v-tooltip>
                                        <v-tooltip text="Delete">
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
                    </v-data-table>
                    <v-btn right @click="addProcessVaribles" variant="text">ADD PV</v-btn>
                    <div v-if="processVariblesWindow">
                        <v-card elevation="8">
                            <v-card-text>
                                <process-variable
                                    @add-variables="val => copyProcessDefinition.data.push(val)"></process-variable>
                            </v-card-text>
                        </v-card>

                    </div>
                </v-card-text>
                <v-card-actions>
                    <v-btn color="secondary" class="px-4 rounded-pill mx-auto" @click="isViewProcessVariables = false"
                        variant="tonal">Close Dialog</v-btn>
                </v-card-actions>
            </v-card>
            <v-dialog v-model="editDialog" max-width="500">
                <v-card>
                    <v-card-title class="px-4 pt-6 justify-space-between d-flex align-center">
                    </v-card-title>
                    <v-card-text class="px-4">
                        <process-variable :variable="editedItem"
                            @update-variables="val => updateVariable(val)"></process-variable>
                    </v-card-text>
                </v-card>
            </v-dialog>
        </v-dialog>

        <!-- <v-navigation-drawer permanent location="right" :width="400"> {{ panelId }} </v-navigation-drawer> -->
    </div>
</template>

<script>
import partialParse from 'partial-json-parser';
import { VectorStorage } from 'vector-storage';
import { VDataTable } from 'vuetify/labs/VDataTable'
import VueBpmn from './Bpmn.vue';
import BpmnPropertyPanel from './designer/bpmnModeling/bpmn/BpmnPropertyPanel.vue';
import ProcessVariable from './designer/bpmnModeling/bpmn/mapper/ProcessVariable.vue';

export default {
    name: 'ProcessDefinition',
    components: {
        VueBpmn,
        BpmnPropertyPanel,
        VDataTable,
        ProcessVariable
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
            additionalModules: [],
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
        editedItem: null
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
            this.editDialog = true;
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

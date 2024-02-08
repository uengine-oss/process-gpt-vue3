<template>
    <div style="height: 100%;">
        <v-row style="height: 103%;">
            <v-col class="d-flex">
                <v-card elevation="1">
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
        <!-- <v-navigation-drawer permanent location="right" :width="400"> {{ panelId }} </v-navigation-drawer> -->
    </div>
</template>

<script>
import partialParse from 'partial-json-parser';
import { VectorStorage } from 'vector-storage';

import VueBpmn from './Bpmn.vue';
import BpmnPropertyPanel from './designer/bpmnModeling/bpmn/BpmnPropertyPanel.vue';

export default {
    name: 'ProcessDefinition',
    components: {
        VueBpmn,
        BpmnPropertyPanel
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
        element: null,
        definitions: null
    }),
    computed() {
        // bpmnModel() {
        //     this.bpmn
        // }
    },
    created() { },
    methods: {
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
        updateElement(element) { },
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

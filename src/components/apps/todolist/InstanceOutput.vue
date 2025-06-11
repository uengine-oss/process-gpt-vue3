<template>
    <v-card elevation="10" class="w-100">
        <v-row v-if="outputList.length > 0" class="ma-0 pa-0" style="height:calc(100vh - 255px); overflow:auto;">
            <v-col v-for="item in outputList" :key="item.id" cols="12" :lg="isInWorkItem ? 12 : 6" :md="isInWorkItem ? 12 : 6" sm="12">
                <v-card elevation="10" class="h-100">
                    <v-card-title> {{ item.name }} </v-card-title>
                    <v-card-text>
                        <DynamicForm :formHTML="item.html" v-model="item.output" :readonly="true" class="dynamic-form" />
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>
    </v-card>
</template>

<script>
import DynamicForm from '@/components/designer/DynamicForm.vue';

import BackendFactory from "@/components/api/BackendFactory";
const backend = BackendFactory.createBackend();

export default {
    components: {
        DynamicForm,
    },
    props: {
        instance: Object,
        isInWorkItem: {
            type: Boolean,
            default: false
        }
    },
    data: () => ({
        outputList: [],
    }),
    mounted() {
        this.init();
    },
    computed: {
        mode() {
            return window.$mode;
        },
        id() {
            const route = this.mode == 'ProcessGPT' ? decodeURIComponent(atob(this.$route.params.instId)) : this.$route.params.instId;
            return route;
        },        
    },
    watch: {
        $route: {
            deep: true,
            handler(newVal, oldVal) {
                if (newVal.params.instId && newVal.params.instId !== oldVal.params.instId) {
                    this.outputList = [];
                    this.init();
                }
            }
        },
    },
    methods: {
        async init() {
            this.outputList = [];
            const formOptions = {
                match: {
                    proc_def_id: this.instance.proc_def_id, 
                }
            }
            const formList = await backend.listDefinition('form_def', formOptions);
            const taskList = await backend.getAllWorkListByInstId(this.instance.instanceId);
            const outputList = [];
            taskList.forEach(async (item) => {
                if (item.status !== 'DONE') return;
                const formId = item.tool.replace('formHandler:', '');
                const form = formList.find(form => form.id === formId);
                if (form) {
                    if (item.task.output && item.task.output[formId]) {
                        outputList.push({
                            id: formId,
                            name: item.title,
                            html: form.html,
                            output: item.task.output[formId],
                        });
                    } else {
                        let formData = {}
                        form.fields_json.map(field => {
                            formData[field.key] = field.type == 'text' || field.type == 'textarea' ? '' : null;
                        })
                        outputList.push({
                            id: formId,
                            name: item.title,
                            html: form.html,
                            output: formData,
                        });
                    }
                }
            })
            console.log(outputList);
            this.outputList = outputList;
        },
    },
}
</script>


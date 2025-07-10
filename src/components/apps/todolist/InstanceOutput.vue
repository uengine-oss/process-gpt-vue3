<template>
    <div class="w-100">
        <v-row v-if="outputList.length > 0" 
            class="ma-0 pa-0" 
            style="height:calc(100vh - 180px); overflow: auto;"
        >
            <v-col v-for="item in outputList" 
                :key="item.id" cols="12" 
                :lg="isInWorkItem ? 12 : 6" 
                :md="isInWorkItem ? 12 : 6" 
                sm="12"
                class="pa-0"
            >
                <div class="h-100">
                    <v-card-title class="pa-0 pb-2"> {{ item.name }} </v-card-title>
                    <v-card-text class="pa-0">
                        <DynamicForm v-if="item.type === 'form'" :formHTML="item.html" v-model="item.output" :readonly="true" class="dynamic-form" />
                        <div v-else-if="item.type === 'html'" v-html="item.html" class="border border-1 border-gray-300 rounded-md pa-2"></div>
                    </v-card-text>
                </div>
            </v-col>
        </v-row>
    </div>
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
        id() {
            return this.$route.params.instId.replace(/_DOT_/g, '.');
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
                    proc_def_id: this.instance.defId, 
                }
            }
            const formList = await backend.listDefinition('form_def', formOptions);
            
            const taskList = await backend.getAllWorkListByInstId(this.instance.instId);
            const sortedTaskList = taskList.sort((a, b) => new Date(b.endDate) - new Date(a.endDate));

            const outputList = [];
            sortedTaskList.forEach(async (item) => {
                if (item.status !== 'DONE') return;
                if (item.task.agent_mode === 'A2A') {
                    outputList.push({
                        id: item.id,
                        type: 'html',
                        name: item.task.activity_name,
                        html: item.task.output['html'],
                        output: item.task.output['table_data'],
                    });
                }
                const formId = item.tool.replace('formHandler:', '');
                const form = formList.find(form => form.id === formId);
                if (form) {
                    if (item.task.output && item.task.output[formId]) {
                        outputList.push({
                            id: formId,
                            type: 'form',
                            name: item.name,
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
                            type: 'form',
                            name: item.name,
                            html: form.html,
                            output: formData,
                        });
                    }
                }
            })
            this.outputList = outputList;
        },
    },
}
</script>


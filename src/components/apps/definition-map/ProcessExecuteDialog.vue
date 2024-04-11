<template>
    <div>
        <v-dialog max-width="500">
            <v-card>
                <v-card-title>
                    Process 실행
                </v-card-title>

                <v-card-text>
                    <!-- Role Mapping Context -->
                    <bpmn-role-parameter-contexts></bpmn-role-parameter-contexts>
                </v-card-text>
                
                <v-card-actions class="justify-center">
                    <v-btn color="primary" 
                        variant="flat"
                        class="cp-process-save"
                        :disabled="newProcess.id == '' && newProcess.label == ''"
                        @click="executeProcess"
                    >실행</v-btn>
                    <v-btn color="error" 
                        variant="flat" 
                        @click="closeDialog('add')"
                    >닫기</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import BpmnRoleParameterContexts from '@/components/designer/bpmnModeling/bpmn/role/BpmnRoleParameterContexts.vue';
export default {
    components: { BpmnRoleParameterContexts },
    props: {
        process: Object,
        enableEdit: Boolean,
        definitions: Object,
        type: String,
        processDialogStatus: Boolean,
        processType: String
    },
    data: () => ({
        newProcess: {
            id: "",
            label: ""
        },
        isNewDef: false,
        addDialog: false,
        updateDialog: false,
    }),
    computed: {
        addType() {
            if (this.type == 'map') {
                return "mega";
            } else if (this.type == 'mega') {
                return "major";
            } else if (this.type == 'major') {
                return "sub";
            }
        },
    },
    watch: {
        isNewDef(val) {
            // if (val) {
            //     this.newProcess = {
            //         id: "",
            //         label: "",
            //     };
            // } else {
            //     this.newProcess = {
            //         id: "",
            //         label: "",
            //         name: ""
            //     };
            // }
        },
        processDialogStatus(val) {
            if(!val) return
            if (this.processType == 'add') {
                // this.newProcess = {
                //     id: "",
                //     label: "",
                //     name: ""
                // };
                this.addDialog = true
            } else if(this.processType == 'update') {
                this.newProcess.id = this.process.id;
                this.newProcess.label = this.process.label;
                this.updateDialog = true
            }
        }
    },
    created() {
    },
    methods: {
        closeDialog(type) {
            // this.newProcess = {
            //     id: "",
            //     label: ""
            // };
            this.isNewDef = false;
            if (type == 'add') {
                this.addDialog = false;
            } else if(type == 'update') {
                this.updateDialog = false;
            }
            this.$emit('closeProcessDialog');
        },
        addProcess() {
            if (this.newProcess.id != '' && (this.newProcess.name != '' || this.newProcess.label != '')) {
                this.$emit("add", this.newProcess);
                this.closeDialog('add');
            }
        },
        updateProcess() {
            if (this.newProcess.id != '' && this.newProcess.label != '') {
                this.$emit("edit", this.newProcess);
                this.closeDialog('update');
            }
        },
    },
}
</script>
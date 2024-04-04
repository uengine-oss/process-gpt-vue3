<template>
    <div v-if="enableEdit">
        <v-dialog v-model="addDialog" max-width="500">
            <v-card>
                <v-card-title>
                    {{ addType.toUpperCase() }} 프로세스 추가
                </v-card-title>

                <v-card-text>
                    <v-autocomplete
                        v-if="addType == 'sub' && !isNewDef && definitions"
                        v-model="newProcess"
                        :items="definitions"
                        label="프로세스 정의"
                        item-title="name"
                        return-object
                    ></v-autocomplete>

                    <v-checkbox
                        v-if="addType == 'sub'"
                        v-model="isNewDef"
                        class="cp-custom-sub"
                        label="새로운 프로세스 정의 추가"
                        color="primary"
                        density="compact"
                    ></v-checkbox>

                    <v-text-field
                        v-if="addType != 'sub' || isNewDef"
                        class="cp-process-id"
                        v-model="newProcess.id"
                        label="프로세스 ID"
                        autofocus
                    ></v-text-field>
                    
                    <v-text-field
                        v-if="addType != 'sub' || isNewDef"
                        v-model="newProcess.label"
                        class="cp-process-name"
                        label="프로세스명"
                    ></v-text-field>
                </v-card-text>
                
                <v-card-actions class="justify-center">
                    <v-btn color="primary" 
                        variant="flat"
                        class="cp-process-save"
                        :disabled="newProcess.id == '' && newProcess.label == ''"
                        @click="addProcess"
                    >저장</v-btn>
                    <v-btn color="error" 
                        variant="flat" 
                        @click="closeDialog('add')"
                    >닫기</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
        <v-dialog v-model="updateDialog" max-width="500">
            <v-card>
                <v-card-title>
                    {{ type.toUpperCase() }} 프로세스 수정
                </v-card-title>
                
                <v-card-text>
                    <v-text-field
                        v-model="newProcess.id"
                        label="프로세스 ID"
                        autofocus
                    ></v-text-field>
                    <v-text-field
                        v-model="newProcess.label"
                        label="프로세스명"
                    ></v-text-field>
                </v-card-text>
                
                <v-card-actions class="justify-center">
                    <v-btn color="primary" 
                        variant="flat"
                        :disabled="newProcess.id == '' && newProcess.label == ''"
                        @click="updateProcess"
                    >저장</v-btn>
                    <v-btn color="error" variant="flat" @click="closeDialog('update')">닫기</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
export default {
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
            if (val) {
                this.newProcess = {
                    id: "",
                    label: "",
                };
            } else {
                this.newProcess = {
                    id: "",
                    label: "",
                    name: ""
                };
            }
        },
        processDialogStatus(val) {
            if(!val) return
            if (this.processType == 'add') {
                this.newProcess = {
                    id: "",
                    label: "",
                    name: ""
                };
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
            this.newProcess = {
                id: "",
                label: ""
            };
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
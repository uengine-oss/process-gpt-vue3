<template>
    <div v-if="enableEdit">
        <div class="d-flex">
            <v-btn icon variant="text" :width="size" :height="size">
                <PlusIcon v-if="type == 'map'" :size="size" />
                <DotsVerticalIcon v-else :size="size" />
                <v-menu activator="parent">
                    <v-list density="compact" class="cursor-pointer">
                        <v-list-item v-if="type != 'sub'" @click="openDialog('add')">
                            <v-list-item-title>
                                <span v-if="addType != 'sub'">{{ addType.toUpperCase() }}</span> 프로세스 추가
                            </v-list-item-title>
                        </v-list-item>
                        <v-list-item v-else @click="editProcess">
                            <v-list-item-title>
                                프로세스 편집
                            </v-list-item-title>
                        </v-list-item>
                        <v-list-item v-if="type != 'map'" @click="openDialog('update')">
                            <v-list-item-title>
                                수정
                            </v-list-item-title>
                        </v-list-item>
                        <v-list-item v-if="type != 'map'" @click="deleteProcess">
                            <v-list-item-title>
                                삭제
                            </v-list-item-title>
                        </v-list-item>
                        <v-list-item v-if="type == 'mega'" @click="openViewProcessDetails(process)">
                            <v-list-item-title>
                                상세보기
                            </v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-menu>
            </v-btn>
        </div>
        
        <v-dialog v-model="addDialog" max-width="500">
            <v-card>
                <v-card-title>
                    {{ addType.toUpperCase() }} 프로세스 추가
                </v-card-title>

                <v-card-text>
                    <v-autocomplete
                        v-if="addType == 'sub' && !isNewDef"
                        v-model="newProcess"
                        :items="definitions"
                        label="프로세스 정의"
                        item-title="name"
                        return-object
                    ></v-autocomplete>

                    <v-checkbox
                        v-if="addType == 'sub'"
                        v-model="isNewDef"
                        label="새로운 프로세스 정의 추가"
                        color="primary"
                        density="compact"
                    ></v-checkbox>

                    <v-text-field
                        v-if="addType != 'sub' || isNewDef"
                        v-model="newProcess.id"
                        label="프로세스 ID"
                        autofocus
                    ></v-text-field>
                    
                    <v-text-field
                        v-if="addType != 'sub' || isNewDef"
                        v-model="newProcess.label"
                        label="프로세스명"
                    ></v-text-field>
                </v-card-text>
                
                <v-card-actions class="justify-center">
                    <v-btn color="primary" 
                        variant="flat"
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
        size: Number,
        type: String,
        process: Object,
        storage: Object,
    },
    data: () => ({
        addDialog: false,
        updateDialog: false,
        newProcess: {
            id: "",
            label: ""
        },
        selectedProcessId: "",
        isNewDef: false,
        definitions: [],
        enableEdit: null,
        
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
        }
    },
    created() {
        const isAdmin = localStorage.getItem("isAdmin");
        if (isAdmin == "true") {
            this.enableEdit = true;
        } else {
            this.enableEdit = false;
        }

        this.init();
    },
    methods: {
        async init() {
            if (this.addType == 'sub') {
                this.definitions = await this.storage.list(`proc_def`);
            }
        },
        openViewProcessDetails(process) {
            this.$router.push(`/definition-map/mega/${process.id}`);
        },
        addProcess() {
            if (this.newProcess.id != '' && (this.newProcess.name != '' || this.newProcess.label != '')) {
                this.$emit("add", this.newProcess);
                this.closeDialog('add');
            }
        },
        openDialog(type) {
            if (type == 'add') {
                this.newProcess = {
                    id: "",
                    label: "",
                    name: ""
                };
                this.addDialog = true;
            } else if(type == 'update') {
                this.selectedProcessId = this.process.id;
                this.newProcess.id = this.process.id;
                this.newProcess.label = this.process.label;
                this.updateDialog = true;
            }
        },
        updateProcess() {
            if (this.newProcess.id != '' && this.newProcess.label != '') {
                this.$emit("edit", this.newProcess, this.type, this.selectedProcessId);
                this.closeDialog('update');
            }
        },
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
        },
        deleteProcess() {
            this.selectedProcessId = this.process.id;
            this.$emit("delete", this.type, this.selectedProcessId);
        },
        editProcess() {
            this.$emit("modeling");
        }
    },
}
</script>
<template>
    <div v-if="enableEdit">
        <v-dialog v-model="subProcessDialogStauts" max-width="500">
            <v-card>
                <v-card-title>
                    <template v-if="$i18n.locale === 'ko'">
                        {{ addType.toUpperCase() }} 프로세스 추가
                    </template>
                    <template v-else>
                        Add {{ addType.toUpperCase() }} Process
                    </template>
                </v-card-title>

                <v-card-text>
                    <ProcessDefinitionDisplay
                        v-if="addType == 'sub' && definitions" 
                        v-model="newProcess"
                        :file-extensions="['.bpmn']"
                        :options="{
                            label: $t('processDialog.processDefinition'),
                            returnObject: true
                        }"
                    ></ProcessDefinitionDisplay>
                   
                    <!-- <v-checkbox
                        v-if="addType == 'sub'"
                        v-model="isNewDef"
                        class="cp-custom-sub"
                        :label="$t('processDialog.newProcessDefinition')"
                        color="primary"
                        density="compact"
                    ></v-checkbox> -->
                    
                    <v-text-field
                        v-if="addType != 'sub'"
                        v-model="newProcess.name"
                        class="cp-process-name"
                        :label="$t('processDialog.processName')"
                    ></v-text-field>
                </v-card-text>
                
                <v-card-actions class="justify-center">
                    <v-btn color="primary" 
                        variant="flat"
                        class="cp-process-save"
                        @click="addProcess()"
                    >{{ $t('processDialog.save') }}</v-btn>
                    <v-btn color="error" 
                        variant="flat" 
                        @click="closeDialog()"
                    >{{ $t('processDialog.close') }}</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
        <div v-if="processType === 'add' && !subProcessDialogStauts">
            <v-row class="ma-0 pa-0" align="center">
                <v-col class="ma-0 pa-0" cols="12">
                    <v-row v-if="addType == 'sub'" justify="end" class="ma-0 pa-0">
                        <v-tooltip :text="$t('processDialog.Close')">
                            <template v-slot:activator="{ props }">
                                <v-btn @click="closeDialog()"
                                    icon v-bind="props"
                                    density="compact"
                                    size="small"
                                >
                                    <Icons :icon="'close'"  :width="12" :height="12" />
                                </v-btn>
                            </template>
                        </v-tooltip>
                    </v-row>
                </v-col>
            </v-row>
            <!-- <v-row v-if="isNewDef || addType === 'mega' || addType === 'major'" justify="end" class="ma-0 pa-0" style="margin-top: -22px !important;">
                <v-spacer></v-spacer>
                <v-tooltip :text="$t('processDialog.close')">
                    <template v-slot:activator="{ props }">
                        <v-btn @click="closeDialog()"
                            icon v-bind="props"
                            density="compact"
                            size="small"
                        >
                            <Icons :icon="'close'"  :width="12" :height="12" />
                        </v-btn>
                    </template>
                </v-tooltip>
                <v-col cols="12" class="ma-0 pa-0">
                    <v-text-field
                        class="cp-process-id"
                        v-model="newProcess.name"
                        :label="$i18n.locale === 'ko' ? `${addType.toUpperCase()} 프로세스 추가` : `Add ${addType.toUpperCase()} Process`"
                        autofocus
                        @keypress.enter="addProcess()"
                        @click.stop
                    ></v-text-field>
                </v-col>
            </v-row> -->
        </div>
        <v-row v-if="processType === 'update'" justify="end" class="ma-0 pa-0">
            <v-spacer></v-spacer>
            <v-tooltip :text="$t('processDialog.Close')">
                <template v-slot:activator="{ props }">
                    <v-btn @click.stop="closeDialog()"
                        icon v-bind="props"
                        density="compact"
                        size="small"
                    >
                        <Icons :icon="'close'"  :width="12" :height="12" />
                    </v-btn>
                </template>
            </v-tooltip>
            <v-col cols="12"  class="ma-0 pa-0">
                <div max-width="500">
                    <v-text-field
                        class="delete-input-details"
                        v-model="newProcess.name"
                        autofocus
                        :label="$t('processDialog.editProcess')"
                        @keypress.enter="updateProcess"
                        @click.stop
                    ></v-text-field>
                </div>
            </v-col>
        </v-row>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import ProcessDefinitionDisplay from '@/components/designer/ProcessDefinitionDisplay.vue'

export default {
    components: {
        ProcessDefinitionDisplay
    },
    props: {
        process: Object,
        enableEdit: Boolean,
        type: String,
        processDialogStatus: Boolean,
        processType: String,
        subProcessDialogStauts: Boolean
    },
    data: () => ({
        newProcess: {
            id: '',
            name: '',
        },
        definitions: null,
        
    }),
    mounted() {
            if(!this.processDialogStatus) return;
            if(this.processType == 'update') {
                this.newProcess.id = this.process.id;
                this.newProcess.name = this.process.name;
            }
    },
    computed: {
        addType() {
            if (this.type == 'map') {
                return "mega";
            } else if (this.type == 'mega') {
                return "major";
            } else if (this.type == 'major') {
                return "sub";
            }
        }
    },
    watch: {
        processDialogStatus(val) {
            if(!val) return
            if (this.processType == 'add') {
                // this.newProcess = {
                //     id: "",
                //     label: "",
                //     name: ""
                // };
            } else if(this.processType == 'update') {
                this.newProcess.id = this.process.id;
                this.newProcess.name = this.process.name;
            }
        }
    },
    created() {
        this.init();
    },
    methods: {
        async init() {
            const backend = BackendFactory.createBackend();
            if (this.addType == 'sub') {
                const list = await backend.listDefinition();
                if (list && list.length > 0) {
                    this.definitions = list.map(item => ({
                        ...item,
                        id: item.id ? item.id : item.path.split('.')[0],
                    }));
                } else {
                    this.definitions = null;
                }
            }
        },
        closeDialog() {
            // this.newProcess = {
            //     id: "",
            //     label: ""
            // };
            this.$emit('closeProcessDialog');
        },
        addProcess() {
            if (this.newProcess.name != '') {
                this.$emit("add", this.newProcess);
                if(this.addType === 'sub') {
                    this.closeDialog();
                }
                this.newProcess.name = '';
            }
        },
        updateProcess() {
            if (this.newProcess.id != '') {       
                this.$emit("edit", this.newProcess);
                this.closeDialog();
            }
        },
    },
}
</script>
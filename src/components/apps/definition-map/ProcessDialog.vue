<template>
    <div v-if="enableEdit" class="pa-1">
        <v-card variant="outlined" class="pa-4" style="border: 2px solid rgba(var(--v-theme-primary), 0.3); border-radius: 12px; background-color: rgba(var(--v-theme-primary), 0.02);">
            <v-row justify="end" class="ma-0 pa-0 mb-2">
                <v-spacer></v-spacer>
                <v-btn @click="closeDialog()"
                    icon
                    variant="text"
                    density="compact"
                    size="small"
                >
                    <v-icon size="18">mdi-close</v-icon>
                </v-btn>
            </v-row>
            
            <v-row class="ma-0 pa-0">
                <v-col cols="12" class="ma-0 pa-0">
                    <ProcessDefinitionDisplay
                        v-if="addType == 'sub' && !isNewDef" 
                        v-model="newProcess"
                        :file-extensions="['.bpmn']"
                        :options="{
                            label: $t('processDialog.processDefinition'),
                            returnObject: true,
                            hideDetails: true
                        }"
                    ></ProcessDefinitionDisplay>
                    
                    <v-combobox
                        v-if="addType == 'major'"
                        v-model="newProcess.domain"
                        :items="domainNames"
                        :label="$t('metricsView.domain') || '도메인'"
                        variant="outlined"
                        class="mb-4"
                        density="comfortable"
                        hide-details="auto"
                        color="primary"
                        :placeholder="$t('processDialog.selectOrEnterDomain') || '도메인을 선택하거나 입력하세요'"
                    ></v-combobox>

                    <v-text-field
                        v-if="addType != 'sub' || isNewDef"
                        class="cp-process-id"
                        v-model="newProcess.name"
                        variant="outlined"
                        color="primary"
                        density="comfortable"
                        :label="$i18n.locale === 'ko' ? (processType === 'add' ? `${addType.toUpperCase()} 프로세스 추가` : `${addType.toUpperCase()} 프로세스 수정`) : (processType === 'add' ? `Add ${addType.toUpperCase()} Process` : `Edit ${addType.toUpperCase()} Process`)"
                        autofocus
                        @keypress.enter="processType === 'add' ? addProcess() : updateProcess()"
                        @click.stop
                    ></v-text-field>
                </v-col>
            </v-row>

            <v-row class="ma-0 pa-0 mt-4">
                <v-spacer></v-spacer>
                <v-btn 
                    @click="processType === 'add' ? addProcess() : updateProcess()"
                    :disabled="isNewDef ? newProcess.id == '' && newProcess.name == '' : (addType == 'sub' ? !newProcess.id : !newProcess.name)"
                    color="primary"
                    variant="flat"
                    class="rounded-pill px-6"
                    size="small"
                >
                    {{ $t('common.save') || '저장' }}
                </v-btn>
            </v-row>
        </v-card>
    </div>
</template>

<script>
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
        domains: Array
    },
    data: () => ({
        newProcess: {
            id: '',
            name: '',
            domain: ''
        },
        isNewDef: false
    }),
    mounted() {
            if(!this.processDialogStatus) return;
            if(this.processType == 'update') {
                this.newProcess.id = this.process.id;
                this.newProcess.name = this.process.name;
                this.newProcess.domain = this.process.domain;
            }
    },
    computed: {
        domainNames() {
            if (!this.domains) return [];
            return this.domains.map(d => d.name);
        },
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
            } else if(this.processType == 'update') {
                this.newProcess.id = this.process.id;
                this.newProcess.name = this.process.name;
            }
        }
    },
    methods: {
        closeDialog() {
            // this.newProcess = {
            //     id: "",
            //     label: ""
            // };
            this.isNewDef = false;
            this.$emit('closeProcessDialog');
        },
        addProcess() {
            if (this.newProcess.name != '') {
                this.$emit("add", this.newProcess);
                if(this.addType === 'sub') {
                    this.closeDialog();
                }
                this.newProcess.name = '';
                this.newProcess.domain = '';
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
<template>
    <div class="pa-5">
        <!-- Matrix Table -->
        <v-card elevation="3" class="overflow-x-auto">
            <v-table density="comfortable" class="metrics-table">
                <thead>
                    <tr>
                        <th class="mega-header text-center" style="min-width: 120px; width: 120px;">
                            <!-- {{ $t('metricsView.domain') }} -->
                        </th>
                        <th 
                            v-for="megaProc in value.mega_processes" 
                            :key="megaProc.id"
                            class="mega-header text-center"
                            style="min-width: 150px;"
                        >
                            <div class="d-flex align-center justify-center">
                                <span class="mega-header-text">{{ megaProc.name }}</span>
                                <v-btn 
                                    v-if="enableEdit"
                                    icon 
                                    variant="text" 
                                    size="x-small" 
                                    class="ml-1"
                                    @click="editMegaProcess(megaProc)"
                                >
                                    <v-icon size="14">mdi-pencil</v-icon>
                                </v-btn>
                                <v-btn 
                                    v-if="enableEdit"
                                    icon 
                                    variant="text" 
                                    size="x-small"
                                    color="error"
                                    @click="deleteMegaProcess(megaProc)"
                                >
                                    <v-icon size="14">mdi-delete</v-icon>
                                </v-btn>
                            </div>
                        </th>
                        <!-- Add Mega Process column at the end -->
                        <th v-if="enableEdit" class="add-column-header text-center" style="min-width: 100px;">
                            <v-btn 
                                variant="text" 
                                size="small"
                                color="primary"
                                @click="addMegaProcess"
                            >
                                <v-icon size="16" start>mdi-plus</v-icon>
                                {{ $t('metricsView.addMegaProcess') }}
                            </v-btn>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="domain in value.domains" :key="domain.id" class="domain-row">
                        <td class="domain-cell text-center">
                            <div class="d-flex align-center justify-center">
                                <span class="domain-cell-text">{{ domain.name }}</span>
                                <v-btn 
                                    v-if="enableEdit"
                                    icon 
                                    variant="text" 
                                    size="x-small" 
                                    class="ml-1"
                                    @click="editDomain(domain)"
                                >
                                    <v-icon size="14">mdi-pencil</v-icon>
                                </v-btn>
                                <v-btn 
                                    v-if="enableEdit"
                                    icon 
                                    variant="text" 
                                    size="x-small"
                                    color="error"
                                    @click="deleteDomain(domain)"
                                >
                                    <v-icon size="14">mdi-delete</v-icon>
                                </v-btn>
                            </div>
                        </td>
                        <td 
                            v-for="megaProc in value.mega_processes" 
                            :key="`${domain.id}-${megaProc.id}`"
                            class="process-cell"
                        >
                            <div class="process-list">
                                <div 
                                    v-for="proc in getProcesses(domain.id, megaProc.id)" 
                                    :key="proc.id"
                                    class="process-item mb-2"
                                >
                                    <!-- Process Name (clickable to navigate) -->
                                    <div class="d-flex align-center">
                                        <span 
                                            class="process-name font-weight-medium cursor-pointer"
                                            @click="goProcess(proc)"
                                        >{{ proc.name }}</span>
                                        <div v-if="enableEdit" class="process-actions ml-2">
                                            <v-btn 
                                                icon 
                                                variant="text" 
                                                size="x-small"
                                                @click="editProcess(proc)"
                                            >
                                                <v-icon size="12">mdi-pencil</v-icon>
                                            </v-btn>
                                            <v-btn 
                                                icon 
                                                variant="text" 
                                                size="x-small"
                                                color="error"
                                                @click="removeProcess(proc)"
                                            >
                                                <v-icon size="12">mdi-delete</v-icon>
                                            </v-btn>
                                        </div>
                                    </div>
                                    
                                    <!-- Sub Process List -->
                                    <div v-if="proc.sub_proc_list && proc.sub_proc_list.length > 0" class="sub-processes mt-1">
                                        <div 
                                            v-for="sub in proc.sub_proc_list" 
                                            :key="sub.id"
                                            class="sub-process-item d-flex align-center"
                                        >
                                            <span 
                                                class="cursor-pointer text-caption text-grey-darken-1"
                                                @click="goSubProcess(sub)"
                                            >• {{ sub.name }}</span>
                                            <v-btn 
                                                v-if="enableEdit"
                                                icon 
                                                variant="text" 
                                                size="x-small"
                                                color="error"
                                                @click="removeSubProcess(proc, sub)"
                                            >
                                                <v-icon size="10">mdi-close</v-icon>
                                            </v-btn>
                                        </div>
                                    </div>
                                    
                                    <!-- Add Sub Process Button -->
                                    <v-btn 
                                        v-if="enableEdit"
                                        variant="text" 
                                        size="x-small"
                                        color="secondary"
                                        @click="openSubProcessSelector(proc)"
                                        class="mt-1"
                                    >
                                        <v-icon size="12" start>mdi-plus</v-icon>
                                        {{ $t('processDefinitionMap.addSub') }}
                                    </v-btn>
                                </div>
                                <v-btn 
                                    v-if="enableEdit"
                                    variant="text" 
                                    size="small"
                                    color="primary"
                                    @click="addProcess(domain.id, megaProc.id)"
                                    class="add-process-btn"
                                >
                                    <v-icon size="14" start>mdi-plus</v-icon>
                                    {{ $t('metricsView.addProcess') }}
                                </v-btn>
                            </div>
                        </td>
                        <!-- Empty cell for add column -->
                        <td v-if="enableEdit" class="add-column-cell"></td>
                    </tr>
                    <!-- Add Domain row at the bottom -->
                    <tr v-if="enableEdit" class="add-row">
                        <td class="add-domain-cell text-center" :colspan="value.mega_processes.length + 2">
                            <v-btn 
                                variant="text" 
                                size="small"
                                color="primary"
                                @click="addDomain"
                            >
                                <v-icon size="16" start>mdi-plus</v-icon>
                                {{ $t('metricsView.addDomain') }}
                            </v-btn>
                        </td>
                    </tr>
                </tbody>
            </v-table>
        </v-card>

        <!-- Add/Edit Dialog for Domain, MegaProcess, Process -->
        <v-dialog v-model="dialog.show" max-width="500" persistent>
            <v-card>
                <v-card-title>{{ dialog.title }}</v-card-title>
                <v-card-text>
                    <v-text-field 
                        v-model="dialog.name" 
                        :label="dialog.label"
                        variant="outlined"
                        density="compact"
                        autofocus
                        @keyup.enter="saveDialog"
                    ></v-text-field>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="dialog.show = false">
                        {{ $t('common.cancel') }}
                    </v-btn>
                    <v-btn color="primary" variant="flat" @click="saveDialog">
                        {{ $t('common.save') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Sub Process Selector Dialog (select from saved processes) -->
        <v-dialog v-model="subProcessDialog.show" max-width="500" persistent>
            <v-card>
                <v-card-title>{{ $t('processDefinitionMap.addSub') }}</v-card-title>
                <v-card-text>
                    <ProcessDefinitionDisplay
                        v-model="subProcessDialog.selectedProcess"
                        :file-extensions="['.bpmn']"
                        :options="{
                            label: $t('processDialog.processDefinition') || '프로세스 정의 선택',
                            returnObject: true,
                            hideDetails: true
                        }"
                    ></ProcessDefinitionDisplay>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="subProcessDialog.show = false">
                        {{ $t('common.cancel') }}
                    </v-btn>
                    <v-btn 
                        color="primary" 
                        variant="flat" 
                        @click="addSelectedSubProcess"
                        :disabled="!subProcessDialog.selectedProcess || !subProcessDialog.selectedProcess.id"
                    >
                        {{ $t('common.save') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import ProcessDefinitionDisplay from '@/components/designer/ProcessDefinitionDisplay.vue';

export default {
    name: 'MetricsView',
    components: {
        ProcessDefinitionDisplay
    },
    props: {
        value: {
            type: Object,
            default: () => ({
                domains: [],
                mega_processes: [],
                processes: []
            })
        },
        enableEdit: {
            type: Boolean,
            default: false
        }
    },
    emits: ['update:value'],
    data() {
        return {
            dialog: {
                show: false,
                type: '', // 'domain', 'megaProcess', 'process'
                mode: '', // 'add', 'edit'
                title: '',
                label: '',
                name: '',
                editItem: null,
                domainId: null,
                megaProcessId: null
            },
            subProcessDialog: {
                show: false,
                parentProcess: null,
                selectedProcess: null
            }
        };
    },
    methods: {
        generateId() {
            return Math.random().toString(36).substring(2, 15);
        },
        getProcesses(domainId, megaProcessId) {
            if (!this.value.processes) return [];
            return this.value.processes.filter(
                proc => proc.domain_id === domainId && proc.mega_process_id === megaProcessId
            );
        },
        goProcess(proc) {
            if (this.enableEdit) return;
            if (window.$mode == 'ProcessGPT') {
                this.$router.push(`/definition-map/sub/${proc.id}`);
            } else {
                this.$emit('clickProcess', proc.id);
            }
        },
        goSubProcess(sub) {
            if (this.enableEdit) return;
            if (window.$mode == 'ProcessGPT') {
                this.$router.push(`/definition-map/sub/${sub.id}`);
            } else {
                this.$emit('clickProcess', sub.id);
            }
        },
        addDomain() {
            this.dialog = {
                show: true,
                type: 'domain',
                mode: 'add',
                title: this.$t('metricsView.addDomain'),
                label: this.$t('metricsView.domainName'),
                name: '',
                editItem: null,
                domainId: null,
                megaProcessId: null
            };
        },
        editDomain(domain) {
            this.dialog = {
                show: true,
                type: 'domain',
                mode: 'edit',
                title: this.$t('metricsView.editDomain'),
                label: this.$t('metricsView.domainName'),
                name: domain.name,
                editItem: domain,
                domainId: null,
                megaProcessId: null
            };
        },
        deleteDomain(domain) {
            if (confirm(this.$t('metricsView.confirmDeleteDomain'))) {
                const newValue = { ...this.value };
                newValue.domains = newValue.domains.filter(d => d.id !== domain.id);
                newValue.processes = newValue.processes.filter(p => p.domain_id !== domain.id);
                this.$emit('update:value', newValue);
            }
        },
        addMegaProcess() {
            this.dialog = {
                show: true,
                type: 'megaProcess',
                mode: 'add',
                title: this.$t('metricsView.addMegaProcess'),
                label: this.$t('metricsView.megaProcessName'),
                name: '',
                editItem: null,
                domainId: null,
                megaProcessId: null
            };
        },
        editMegaProcess(megaProc) {
            this.dialog = {
                show: true,
                type: 'megaProcess',
                mode: 'edit',
                title: this.$t('metricsView.editMegaProcess'),
                label: this.$t('metricsView.megaProcessName'),
                name: megaProc.name,
                editItem: megaProc,
                domainId: null,
                megaProcessId: null
            };
        },
        deleteMegaProcess(megaProc) {
            if (confirm(this.$t('metricsView.confirmDeleteMegaProcess'))) {
                const newValue = { ...this.value };
                newValue.mega_processes = newValue.mega_processes.filter(m => m.id !== megaProc.id);
                newValue.processes = newValue.processes.filter(p => p.mega_process_id !== megaProc.id);
                this.$emit('update:value', newValue);
            }
        },
        addProcess(domainId, megaProcessId) {
            this.dialog = {
                show: true,
                type: 'process',
                mode: 'add',
                title: this.$t('metricsView.addProcess'),
                label: this.$t('metricsView.processName'),
                name: '',
                editItem: null,
                domainId: domainId,
                megaProcessId: megaProcessId
            };
        },
        editProcess(proc) {
            this.dialog = {
                show: true,
                type: 'process',
                mode: 'edit',
                title: this.$t('metricsView.editProcess'),
                label: this.$t('metricsView.processName'),
                name: proc.name,
                editItem: proc,
                domainId: proc.domain_id,
                megaProcessId: proc.mega_process_id
            };
        },
        // Remove process from metrics matrix only (not deleting actual process)
        removeProcess(proc) {
            if (confirm(this.$t('metricsView.confirmRemoveProcess') || '이 프로세스를 매트릭스에서 제거하시겠습니까? (실제 프로세스는 삭제되지 않습니다)')) {
                const newValue = { ...this.value };
                newValue.processes = newValue.processes.filter(p => p.id !== proc.id);
                this.$emit('update:value', newValue);
            }
        },
        // Sub Process methods - using ProcessDefinitionDisplay selector
        openSubProcessSelector(parentProcess) {
            this.subProcessDialog = {
                show: true,
                parentProcess: parentProcess,
                selectedProcess: null
            };
        },
        addSelectedSubProcess() {
            if (!this.subProcessDialog.selectedProcess || !this.subProcessDialog.selectedProcess.id) {
                return;
            }

            const newValue = JSON.parse(JSON.stringify(this.value));
            const proc = newValue.processes.find(p => p.id === this.subProcessDialog.parentProcess.id);
            
            if (proc) {
                if (!proc.sub_proc_list) {
                    proc.sub_proc_list = [];
                }
                
                // Check for duplicate
                const isDuplicate = proc.sub_proc_list.some(
                    s => s.id === this.subProcessDialog.selectedProcess.id
                );
                
                if (isDuplicate) {
                    alert(this.$t('processDefinitionMap.duplicateName') || '이미 추가된 프로세스입니다.');
                    return;
                }
                
                proc.sub_proc_list.push({
                    id: this.subProcessDialog.selectedProcess.id,
                    name: this.subProcessDialog.selectedProcess.name
                });
                
                this.$emit('update:value', newValue);
            }
            
            this.subProcessDialog.show = false;
        },
        // Remove sub process from matrix only (not deleting actual process)
        removeSubProcess(parentProcess, sub) {
            if (confirm(this.$t('metricsView.confirmRemoveProcess') || '이 프로세스를 매트릭스에서 제거하시겠습니까?')) {
                const newValue = JSON.parse(JSON.stringify(this.value));
                const proc = newValue.processes.find(p => p.id === parentProcess.id);
                if (proc && proc.sub_proc_list) {
                    proc.sub_proc_list = proc.sub_proc_list.filter(s => s.id !== sub.id);
                }
                this.$emit('update:value', newValue);
            }
        },
        saveDialog() {
            if (!this.dialog.name.trim()) {
                alert(this.$t('metricsView.nameRequired'));
                return;
            }

            const newValue = JSON.parse(JSON.stringify(this.value));
            const trimmedName = this.dialog.name.trim();
            const newId = trimmedName.toLowerCase().replace(/[/.]/g, '_');

            if (this.dialog.type === 'domain') {
                if (this.dialog.mode === 'add') {
                    const newOrder = newValue.domains.length + 1;
                    newValue.domains.push({
                        id: newId,
                        name: trimmedName,
                        order: newOrder
                    });
                } else {
                    const domain = newValue.domains.find(d => d.id === this.dialog.editItem.id);
                    if (domain) {
                        domain.name = trimmedName;
                    }
                }
            } else if (this.dialog.type === 'megaProcess') {
                if (this.dialog.mode === 'add') {
                    const newOrder = newValue.mega_processes.length + 1;
                    newValue.mega_processes.push({
                        id: newId,
                        name: trimmedName,
                        order: newOrder
                    });
                } else {
                    const megaProc = newValue.mega_processes.find(m => m.id === this.dialog.editItem.id);
                    if (megaProc) {
                        megaProc.name = trimmedName;
                    }
                }
            } else if (this.dialog.type === 'process') {
                if (this.dialog.mode === 'add') {
                    newValue.processes.push({
                        id: newId,
                        name: trimmedName,
                        domain_id: this.dialog.domainId,
                        mega_process_id: this.dialog.megaProcessId,
                        sub_proc_list: []
                    });
                } else {
                    const proc = newValue.processes.find(p => p.id === this.dialog.editItem.id);
                    if (proc) {
                        proc.name = trimmedName;
                    }
                }
            }

            this.$emit('update:value', newValue);
            this.dialog.show = false;
        }
    }
};
</script>

<style scoped>
.metrics-table {
    border-collapse: collapse;
}

.domain-header {
    background-color: rgb(var(--v-theme-primary));
    color: white;
    font-weight: 700;
    font-size: 1rem;
    border-bottom: 2px solid rgba(0, 0, 0, 0.2);
}

.mega-header {
    background-color: rgb(var(--v-theme-primary), 0.15);
    border-left: 1px solid rgba(0, 0, 0, 0.12);
    border-bottom: 2px solid rgba(0, 0, 0, 0.2);
    font-weight: 700;
}

.mega-header-text {
    font-size: 1rem;
    font-weight: 700;
}

.add-column-header {
    background-color: rgba(0, 0, 0, 0.02);
    border-left: 1px solid rgba(0, 0, 0, 0.12);
    border-bottom: 2px solid rgba(0, 0, 0, 0.2);
}

.domain-row {
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.domain-cell {
    background-color: rgb(var(--v-theme-primary), 0.08);
    font-weight: 600;
    vertical-align: middle;
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    border-right: 1px solid rgba(0, 0, 0, 0.12);
}

.domain-cell-text {
    font-size: 1rem;
    font-weight: 700;
}

.process-cell {
    border-left: 1px solid rgba(0, 0, 0, 0.12);
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    vertical-align: top;
    padding: 8px !important;
    min-height: 80px;
}

.add-column-cell {
    border-left: 1px solid rgba(0, 0, 0, 0.12);
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    background-color: rgba(0, 0, 0, 0.02);
}

.add-row {
    background-color: rgba(0, 0, 0, 0.02);
}

.add-domain-cell {
    border-top: 2px solid rgba(0, 0, 0, 0.12);
    padding: 12px !important;
}

.process-list {
    min-height: 60px;
}

.process-item {
    padding: 6px 8px;
    background-color: rgba(0, 0, 0, 0.02);
    border-radius: 4px;
    border-left: 3px solid rgb(var(--v-theme-primary));
}

.process-name {
    font-size: 0.875rem;
}

.process-name:hover {
    color: rgb(var(--v-theme-primary));
    text-decoration: underline;
}

.sub-processes {
    margin-left: 8px;
}

.sub-process-item {
    padding: 2px 0;
}

.sub-process-item span:hover {
    color: rgb(var(--v-theme-primary));
    text-decoration: underline;
}

.process-actions {
    display: flex;
    gap: 2px;
}

.add-process-btn {
    margin-top: 4px;
}

.cursor-pointer {
    cursor: pointer;
}
</style>

<template>
    <div class="mb-3">
        <v-card class="align-center bg-lightsecondary pa-2"
            elevation="10"
            style="border-radius: 10px !important; margin-bottom:5px;"
        >
            <h6 v-if="!processDialogStatus || processType === 'add'" class="text-subtitle-1 font-weight-semibold">
                <v-row class="ma-0 pa-0">
                    <v-col cols="8" class="ma-0 pa-0 text-left">
                        <div>{{ value.label }}</div>
                    </v-col>
                    <v-col cols="4" class="ma-0 pa-0">
                        <div class="ml-auto add-major-process">
                            <ProcessMenu
                                :size="16"
                                :type="type"
                                :process="value"
                                :storage="storage"
                                :userInfo="userInfo"
                                :enableEdit="enableEdit"
                                @delete="deleteProcess"
                                @editProcessdialog="editProcessdialog"
                            />
                        </div>
                    </v-col>
                </v-row>
            </h6>
            <ProcessDialog v-else-if="processDialogStatus && enableEdit && processType === 'update'"
                :enableEdit="enableEdit"
                :process="value"
                :processDialogStatus="processDialogStatus"
                :processType="processType"
                :type="type"
                :storage="storage"
                @edit="editProcess"
                @closeProcessDialog="closeProcessDialog"
            />
        </v-card>

        <draggable v-if="enableEdit"
            class="dragArea list-group" 
            :list="value.sub_proc_list" 
            :animation="200" 
            ghost-class="ghost-card"
            group="subProcess"
        >
            <transition-group>
                <div v-for="item in value.sub_proc_list"
                    :key="item.id"
                    class="cursor-pointer"
                >
                    <SubProcess 
                        :value="item" 
                        :parent="value" 
                        :storage="storage"
                        :userInfo="userInfo"
                        :enableEdit="enableEdit"
                        :enableExecution="enableExecution"
                        @view="viewProcess"
                    />
                </div>
            </transition-group>
        </draggable>
        <div v-else>
            <div v-for="item in value.sub_proc_list"
                :key="item.id"
            >
                <SubProcess 
                    :value="item" 
                    :parent="value" 
                    :storage="storage"
                    :enableEdit="enableEdit"
                    :enableExecution="enableExecution"
                    @view="viewProcess"
                />
            </div>
        </div>
        <v-tooltip v-if="!processDialogStatus && enableEdit" text="sub 프로세스 추가">
            <template v-slot:activator="{ props }">
                <v-card @click="openSubProcessDialog('add')"
                    class="add-process-card-hover cp-add-mega pa-2"
                    elevation="9" variant="outlined"
                    v-bind="props"
                    style="display: flex;
                        justify-content: center;
                        align-items: center;
                        border-radius: 10px !important;
                        margin-bottom:10px;
                        height:26px;"
                >
                    <div style="display: flex; justify-content: center; align-items: center;">
                        <Icon icon="streamline:add-1-solid" width="16" height="16" style="color: #5EB2E8" />
                    </div>
                </v-card>
            </template>
        </v-tooltip>
        <ProcessDialog v-else-if="processDialogStatus && enableEdit && processType === 'add'"
            :enableEdit="enableEdit"
            :process="value"
            :processDialogStatus="processDialogStatus"
            :subProcessDialogStauts="subProcessDialogStauts"
            :processType="processType"
            :type="type"
            :storage="storage"
            @add="addProcess"
            @closeProcessDialog="closeProcessDialog"
            style="margin-top:20px !important;"
        />
    </div>
</template>

<script>
import ProcessMenu from './ProcessMenu.vue';
import SubProcess from './SubProcess.vue';
import ProcessDialog from './ProcessDialog.vue';
import BaseProcess from './BaseProcess.vue';

export default {
    components: {
        ProcessMenu,
        SubProcess,
        ProcessDialog
    },
    mixins: [BaseProcess],
    props: {
        value: Object,
        parent: Object,
        storage: Object,
        userInfo: Object,
        enableEdit: Boolean,
        enableExecution: Boolean
    },
    data: () => ({
        type: 'major',
        subProcessDialogStauts: false
    }),
    methods: {
        addProcess(newProcess) {
            var newSubProc = {
                id: newProcess.id,
                label: newProcess.name ? newProcess.name : newProcess.label,
            };
            this.value.sub_proc_list.push(newSubProc);
        },
        openSubProcessDialog(processType) {
            this.processType = processType;
            this.processDialogStatus = true;
            this.subProcessDialogStauts = true;
        },
        deleteProcess() {
            this.parent.major_proc_list = this.parent.major_proc_list.filter(item => item.id != this.value.id);
        },
        viewProcess(process) {
            this.$emit('view', process);
        },
    },
}
</script>
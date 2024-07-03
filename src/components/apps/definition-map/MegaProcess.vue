<template>
    <div class="w-100" @mouseover="hover = true" @mouseleave="hover = false">
        <v-card class="align-center pa-3 mb-3" color="primary" elevation="10" style="border-radius: 10px !important;"
            @click="goProcess(value.name, 'mega')">
            <h6 v-if="!processDialogStatus || processType === 'add'" class="text-h6 font-weight-semibold">
                <v-row class="ma-0 pa-0">
                    <v-col :cols="enableEdit ? '8' : '12'" class="ma-0 pa-0 text-left">
                        <div>{{ value.name }}</div>
                    </v-col>
                    <v-col :cols="enableEdit ? '4' : ''" class="ma-0 pa-0">
                        <div class="ml-auto add-major-process">
                            <ProcessMenu
                                :size="20"
                                :type="type"
                                :process="value"
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
                @edit="editProcess"
                @closeProcessDialog="closeProcessDialog"
            />
        </v-card>
        
        <draggable v-if="enableEdit"
            class="dragArea list-group" 
            :list="value.major_proc_list" 
            :animation="200" 
            ghost-class="ghost-card"
            group="majorProcess"
        >
            <transition-group>
                <div v-for="item in value.major_proc_list" :key="item.id" class="cursor-pointer">
                    <MajorProcess :value="item" :parent="value" :enableEdit="enableEdit" />
                </div>
            </transition-group>
        </draggable>
        <div v-else>
            <div v-for="item in value.major_proc_list" :key="item.id">
                <MajorProcess :value="item" :parent="value" :enableEdit="enableEdit" />
            </div>
        </div>
        <v-card v-if="!processDialogStatus && enableEdit && hover" 
            @click="openProcessDialog('add')"
            class="add-process-card-hover bg-lightsecondary cp-add-mega pa-2"
            elevation="9" variant="outlined"
            style="display: flex;
                justify-content: center;
                align-items: center;
                border-radius: 10px !important;
                height:34px;"
        >
            <v-row class="pa-0 ma-0 definitionMap-add-card">
                <PlusIcon size="20" stroke-width="2" />
                <div>&nbsp;{{ $t('processDefinitionMap.addMajor') }}</div>
            </v-row>
        </v-card>
        <ProcessDialog v-else-if="processDialogStatus && enableEdit && processType === 'add'"
            :enableEdit="enableEdit"
            :process="value"
            :processDialogStatus="processDialogStatus"
            :processType="processType"
            :type="type"
            @add="addProcess"
            @closeProcessDialog="closeProcessDialog"
            style="margin-top:20px !important;"
        />
    </div>
</template>

<script>
import ProcessMenu from './ProcessMenu.vue';
import MajorProcess from './MajorProcess.vue';
import ProcessDialog from './ProcessDialog.vue';
import BaseProcess from './BaseProcess.vue'

export default {
    components: {
        ProcessMenu,
        MajorProcess,
        ProcessDialog
    },
    mixins: [BaseProcess],
    props: {
        value: Object,
        parent: Object,
        enableEdit: Boolean,
    },
    data: () => ({
        type: 'mega',
        hover: false,
    }),
    created() {
    },
    methods:{
        addProcess(newProcess) {
            const id = newProcess.name.toLowerCase().replace(/[/.]/g, "_");
            this.value.major_proc_list.push({
                id: id,
                name: newProcess.name,
                sub_proc_list: [],
            });
        },
        deleteProcess() {
            this.parent.mega_proc_list = this.parent.mega_proc_list.filter(item => item.id != this.value.id);
        },
    },
}
</script>
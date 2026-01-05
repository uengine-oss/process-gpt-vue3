<template>
    <div class="mb-3 major-hover">
        <v-card class="align-center pa-2 pr-2 pl-2 cp-major" elevation="10"
            style="border-radius: 10px !important; margin-bottom:5px; border: 4px solid rgba(var(--v-theme-primary), 0.2);"
        >
            <h6 v-if="!processDialogStatus || processType === 'add'" class="text-subtitle-1 font-weight-semibold">
                <v-row class="ma-0 pa-0 align-center">
                    <v-col cols="auto" class="ma-0 pa-0 text-left flex-grow-1" style="min-width: 0;">
                        <div class="text-truncate font-weight-bold cursor-pointer" style="font-size: 0.9rem;" @click="goProcess(parent.name, 'mega')">{{ value.name }}</div>
                    </v-col>
                    <v-col cols="auto" class="ma-0 pa-0">
                        <ProcessMenu
                            :size="14"
                            :type="type"
                            :process="value"
                            :enableEdit="enableEdit"
                            @add="openSubProcessDialog('add')"
                            @delete="deleteProcess"
                            @editProcessdialog="editProcessdialog"
                            @setPermission="openPermissionDialog(value)"
                        />
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
            :list="value.sub_proc_list" 
            :animation="200" 
            ghost-class="ghost-card"
            group="subProcess"
        >
            <transition-group>
                <div v-for="item in value.sub_proc_list" :key="item.id" class="cursor-pointer">
                    <SubProcess :value="item" :parent="value" :enableEdit="enableEdit" @clickProcess="clickProcess" :isExecutionByProject="isExecutionByProject" @clickPlayBtn="clickPlayBtn"/>
                </div>
            </transition-group>
        </draggable>
        <div v-else>
            <div v-for="item in value.sub_proc_list" :key="item.id">
                <SubProcess :value="item" :parent="value" :enableEdit="enableEdit" @clickProcess="clickProcess" :isExecutionByProject="isExecutionByProject" @clickPlayBtn="clickPlayBtn"/>
            </div>
        </div>
        <!-- Add Sub Process Dialog (shown when + button is clicked) -->
        <ProcessDialog v-if="processDialogStatus && enableEdit && processType === 'add'"
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
        enableEdit: Boolean,
        isExecutionByProject: Boolean
    },
    data: () => ({
        type: 'major'
    }),
    methods: {
        async addProcess(newProcess) {
            // 같은 레벨에 동일한 이름이 있는지 검증
            const isDuplicate = this.value.sub_proc_list.some(
                item => item.name.toLowerCase() === newProcess.name.toLowerCase()
            );
            if (isDuplicate) {
                this.$toast.error(this.$t('processDefinitionMap.duplicateName') || '동일한 이름의 프로세스가 이미 존재합니다.');
                return;
            }

            // Use provided ID or generate one (for existing process selection)
            let processId = newProcess.id;
            if (!processId) {
                // Fallback: generate ID from parent and name (for legacy/existing selection)
                processId = `${this.parent.name}_${newProcess.name}`
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, '_')
                    .replace(/_+/g, '_');
            }

            this.value.sub_proc_list.push({
                id: processId,
                name: newProcess.name
            });

            // Navigate to process editor if this is a newly created process
            if (newProcess.isNew) {
                const url = `/definitions/chat?id=${processId}&name=${encodeURIComponent(newProcess.name)}&modeling=true`;
                window.open(url, '_blank');
            }
        },
        openSubProcessDialog(processType) {
            this.processType = processType;
            this.processDialogStatus = true;
        },
        deleteProcess() {
            this.parent.major_proc_list = this.parent.major_proc_list.filter(item => item.id != this.value.id);
        },
        clickProcess(id) {
            this.$emit('clickProcess', id);
        },
        clickPlayBtn(value){
            this.$emit('clickPlayBtn', value)
        },
    },
}
</script>

<style>
</style>
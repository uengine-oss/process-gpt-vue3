<template>
    <div class="w-100 mega-hover">
        <v-card class="align-center pa-3 mb-3 cp-mega" elevation="10" style="border-radius: 10px !important; background-color: rgba(var(--v-theme-primary), 0.2);">
            <h6 v-if="!processDialogStatus || processType === 'add'" class="text-h6 font-weight-semibold">
                <v-row class="ma-0 pa-0 align-center">
                    <v-col cols="auto" class="ma-0 pa-0 text-left flex-grow-1" style="min-width: 0;">
                        <div class="text-truncate cursor-pointer" @click="goProcess(value.name, 'mega')">{{ value.name }}</div>
                    </v-col>
                    <v-col cols="auto" class="ma-0 pa-0">
                        <ProcessMenu
                            class="mega-proc-btn"
                            :size="20"
                            :type="type"
                            :process="value"
                            :enableEdit="enableEdit"
                            :selectedDomain="selectedDomain"
                            @add="openProcessDialog('add')"
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
            :list="value.major_proc_list"
            :animation="200"
            ghost-class="ghost-card"
            group="majorProcess"
        >
            <transition-group>
                <div v-for="item in filteredMajorProcList" :key="item.id" class="cursor-pointer">
                    <MajorProcess :value="item" :parent="value" :enableEdit="enableEdit" @clickProcess="clickProcess" :isExecutionByProject="isExecutionByProject" @clickPlayBtn="clickPlayBtn" :selectedDomain="selectedDomain" :domains="domains" :filteredProcDefIds="filteredProcDefIds"/>
                </div>
            </transition-group>
        </draggable>
        <div v-else>
            <div v-for="item in filteredMajorProcList" :key="item.id">
                <MajorProcess :value="item" :parent="value" :enableEdit="enableEdit" @clickProcess="clickProcess" :isExecutionByProject="isExecutionByProject" @clickPlayBtn="clickPlayBtn" :selectedDomain="selectedDomain" :domains="domains" :filteredProcDefIds="filteredProcDefIds"/>
            </div>
        </div>
        <!-- Add Major Process Dialog: 특정 도메인 탭에서만 표시 -->
        <ProcessDialog v-if="processDialogStatus && enableEdit && processType === 'add' && selectedDomain"
            :enableEdit="enableEdit"
            :process="value"
            :processDialogStatus="processDialogStatus"
            :processType="processType"
            :type="type"
            :domains="domains"
            :defaultDomain="selectedDomain"
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
        ProcessDialog,
    },
    mixins: [BaseProcess],
    props: {
        value: Object,
        parent: Object,
        enableEdit: Boolean,
        isExecutionByProject: Boolean,
        domains: Array,
        selectedDomain: String,
        filteredProcDefIds: Array  // null = no filter, [] = filter active but no matches
    },
    data: () => ({
        type: 'mega',
        hover: false,
    }),
    computed: {
        filteredMajorProcList() {
            if (!this.selectedDomain || !this.value.major_proc_list) {
                return this.value.major_proc_list || [];
            }
            return this.value.major_proc_list.filter(major => {
                if (this.selectedDomain === 'Access') {
                    return !major.domain || major.domain === 'Access';
                }
                return major.domain === this.selectedDomain;
            });
        }
    },
    created() {
    },
    methods:{
        addProcess(newProcess) {
            // 같은 레벨에 동일한 이름이 있는지 검증
            const isDuplicate = this.value.major_proc_list.some(
                item => item.name.toLowerCase() === newProcess.name.toLowerCase()
            );
            if (isDuplicate) {
                this.$toast.error(this.$t('processDefinitionMap.duplicateName') || '동일한 이름의 프로세스가 이미 존재합니다.');
                return;
            }
            
            const id = newProcess.name.toLowerCase().replace(/[/.]/g, "_");
            const process = {
                id: id,
                name: newProcess.name,
                domain: newProcess.domain,
                sub_proc_list: [],
            }
            this.value.major_proc_list.push(process);
        },
        deleteProcess() {
            this.parent.mega_proc_list = this.parent.mega_proc_list.filter(item => item.id != this.value.id);
        },
        clickProcess(id) {
            this.$emit('clickProcess', id);
        },
        clickPlayBtn(value){
            this.$emit('clickPlayBtn', value)
        },
        editProcess(process) {
            const index = this.value.major_proc_list.findIndex(item => item.id === process.id);
            if (index > -1) {
                this.value.major_proc_list[index].name = process.name;
                this.value.major_proc_list[index].domain = process.domain;
            }
        },
    },
}
</script>

<style>
.mega-proc-btn button {
    color:black;
}
</style>
<template>
    <div class="pa-5">
        <draggable v-if="enableEdit" class="v-row dragArea list-group" :list="value.mega_proc_list" :animation="200"
            ghost-class="ghost-card" group="megaProcess" :draggable="'.draggable-item'">
            <transition-group>
                <v-col v-for="item in value.mega_proc_list" :key="item.id" class="cursor-pointer draggable-item"
                    cols="12" md="2" sm="6">
                    <MegaProcess :value="item" :parent="value" :storage="storage" :userInfo="userInfo"
                        :enableEdit="enableEdit" :enableExecution="enableExecution" @view="viewProcess" />
                </v-col>
                <!-- 실제 카드가 들어가야 할 위치 -->
                <v-col class="cursor-pointer"
                    cols="12" md="2" sm="3"
                >
                    <v-tooltip v-if="!processDialogStatus" text="Mega 프로세스 추가">
                        <template v-slot:activator="{ props }">
                            <v-card @click="openProcessDialog('add')"
                                class="add-process-card-hover bg-lightwarning cp-add-mega"
                                elevation="9" variant="outlined"
                                v-bind="props"
                                style="padding: 10px;
                                    display: flex;
                                    justify-content: center;
                                    align-items: center;
                                    border-radius: 10px !important;"
                            >
                                <div style="display: flex; justify-content: center; align-items: center;">
                                    <Icon icon="streamline:add-1-solid" width="24" height="24" style="color: #5EB2E8" />
                                </div>
                            </v-card>
                        </template>
                    </v-tooltip>
                    <ProcessDialog v-if="processDialogStatus"
                        :enableEdit="enableEdit"
                        :process="value"
                        :definitions="definitions"
                        :processType="processType"
                        :type="'map'"
                        @add="addProcess"
                        @closeProcessDialog="closeProcessDialog"
                    />
                </v-col>
            </transition-group>
        </draggable>
        <v-row v-else>
            <v-col v-for="item in value.mega_proc_list" :key="item.id" class="cursor-pointer" cols="12" md="2" sm="6">
                <MegaProcess :value="item" :parent="value" :storage="storage" :userInfo="userInfo"
                    :enableEdit="enableEdit" :enableExecution="enableExecution" @view="viewProcess"
                    @click="viewProcessDetail(item)" />
            </v-col>
        </v-row>
    </div>
</template>

<script>
import MegaProcess from './MegaProcess.vue';
import ProcessDialog from './ProcessDialog.vue';
import BaseProcess from './BaseProcess.vue'


export default {
    components: {
        MegaProcess,
        ProcessDialog
    },
    mixins:[BaseProcess],
    props: {
        value: Object,
        storage: Object,
        userInfo: Object,
        enableEdit: Boolean,
        enableExecution: Boolean
    },
    data: () => ({
        processType: '',
        processRenderer: 0
    }),
    methods: {
        viewProcess(process) {
            this.$router.push(`/definition-map/sub/${process.id}`)
        },
        viewProcessDetail(process) {
            this.$router.push(`/definition-map/mega/${process.label}`)
        },
        addProcess(newProcess) {
            let id = 0;
            if(this.value.mega_proc_list.length != 0) {
                id = this.value.mega_proc_list[this.value.mega_proc_list.length - 1].id +1
            }
            var newMegaProc = {
                id: id,
                label: newProcess.label,
                major_proc_list: [],
            };
            this.value.mega_proc_list.push(newMegaProc);
        }
    },
}
</script>

<style>
.add-process-card-hover:hover {
    background-color: rgb(33, 150, 243, 0.1)
}
</style>
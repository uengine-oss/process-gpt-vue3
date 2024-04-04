<template>
    <div class="pa-5">
        <draggable v-if="enableEdit"
            class="v-row dragArea list-group" 
            :list="value.mega_proc_list" 
            :animation="200" 
            ghost-class="ghost-card"
            group="megaProcess"
            :draggable="'.draggable-item'"
        >
            <transition-group>
                <v-col v-for="item in value.mega_proc_list"
                    :key="item.id" 
                    class="cursor-pointer draggable-item"
                    cols="12" md="2" sm="6"
                >
                    <MegaProcess 
                        :value="item" 
                        :parent="value" 
                        :storage="storage"
                        :userInfo="userInfo"
                        :enableEdit="enableEdit"
                        @view="viewProcess"
                    />
                </v-col>
                <!-- 실제 카드가 들어가야 할 위치 -->
                <v-col class="cursor-pointer"
                    cols="12" md="2" sm="3"
                    @click="addMegaProcess('add')"
                >
                    <v-card class="add-process-card-hover"
                        elevation="9" variant="outlined"
                        style="padding: 10px; display: flex; justify-content: center; align-items: center; border-radius: 10px !important;"
                    >
                        <div style="display: flex; justify-content: center; align-items: center;">
                            <Icon icon="streamline:add-1-solid" width="24" height="24" style="color: #5EB2E8" />
                        </div>
                    </v-card>
                </v-col>
            </transition-group>
        </draggable>
        <v-row v-else>
            <v-col v-for="item in value.mega_proc_list"
                :key="item.id" 
                class="cursor-pointer"
                cols="12" md="2" sm="6">
                <MegaProcess 
                    :value="item" 
                    :parent="value" 
                    :storage="storage" 
                    :userInfo="userInfo"
                    :enableEdit="enableEdit"
                    @view="viewProcess"
                    @dblclick="viewProcessDetail(item)"
                />
            </v-col>
        </v-row>
        <ProcessDialog
            :enableEdit="enableEdit"
            :process="value" 
            :processDialogStatus="processDialogStatus"
            :definitions="definitions" 
            :processType="processType"
            :type="'map'"
            @add="addProcess"
            @edit="updateProcess"
            @closeProcessDialog="closeProcessDialog"
        />
    </div>
</template>

<script>
import MegaProcess from './MegaProcess.vue';
import ProcessDialog from './ProcessDialog.vue';


export default {
    components: {
        MegaProcess,
        ProcessDialog
    },
    props: {
        value: Object,
        storage: Object,
        userInfo: Object,
        enableEdit: Boolean,
    },
    data: () => ({
        processType: '',
        processDialogStatus: false,
    }),
    methods: {
        viewProcess(process) {
            this.$router.push(`/definition-map/sub/${process.id}`)
        },
        viewProcessDetail(process) {
            this.$router.push(`/definition-map/mega/${process.id}`)
        },
        addMegaProcess(processType) {
            this.processType = processType;
            this.processDialogStatus = true;
        },
        addProcess(newProcess) {
            var newMegaProc = {
                id: newProcess.id,
                label: newProcess.label,
                major_proc_list: [],
            };
            this.value.mega_proc_list.push(newMegaProc);
            this.processDialogStatus = false;
        },
        closeProcessDialog() {
            this.processDialogStatus = false;
        },
    },
}
</script>

<style>
    .add-process-card-hover:hover {
        background-color:rgb(33,150,243, 0.1)
    }
</style>
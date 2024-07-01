<template>
    <div class="pa-5">
        <draggable v-if="enableEdit" class="v-row dragArea list-group" :list="value.mega_proc_list" :animation="200"
            ghost-class="ghost-card" group="megaProcess" :draggable="'.draggable-item'">
            <transition-group>
                <v-col v-for="item in value.mega_proc_list" :key="item.id" class="cursor-pointer draggable-item"
                    cols="12" md="2" sm="6">
                    <MegaProcess :value="item" :parent="value" :enableEdit="enableEdit" />
                </v-col>
                <!-- 실제 카드가 들어가야 할 위치 -->
                <v-col class="cursor-pointer" cols="12" md="2" sm="3">
                    <v-card v-if="!processDialogStatus"
                        @click="openProcessDialog('add')"
                        class="add-process-card-hover bg-lightwarning cp-add-mega"
                        elevation="9" variant="outlined"
                        style="padding: 10px;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            border-radius: 10px !important;"
                    >
                        <v-row class="pa-0 ma-0 definitionMap-add-card">
                            <PlusIcon size="20" stroke-width="2" />
                            <div>&nbsp;{{ $t('processDefinitionMap.addMega') }}</div>
                        </v-row>
                    </v-card>
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
                <MegaProcess :value="item" :parent="value" :enableEdit="enableEdit"/>
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
        enableEdit: Boolean,
    },
    data: () => ({
        processType: '',
        processRenderer: 0
    }),
    methods: {
        addProcess(newProcess) {
            const id = newProcess.name.toLowerCase().replace(/[/.]/g, "_");
            var newMegaProc = {
                id: id,
                name: newProcess.name,
                major_proc_list: [],
            };
            this.value.mega_proc_list.push(newMegaProc);
        },
    },
}
</script>

<style>
.add-process-card-hover:hover {
    background-color: rgb(33, 150, 243, 0.1)
}
</style>
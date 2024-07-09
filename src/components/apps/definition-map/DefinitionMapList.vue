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
                        class="add-process-card-hover cp-add-mega"
                        elevation="9" variant="outlined"
                        color="primary"
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

import BackendFactory from '@/components/api/BackendFactory';

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
    created() {
        this.classifyProcess();
    },
    watch: {
        enableEdit(newVal, oldVal) {
            if(newVal !== oldVal) {
                this.classifyProcess();
            }
        }
    },
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
        async classifyProcess() {
            let subProcList = [];
            let unclassifiedIdx = -1;
            this.value.mega_proc_list.forEach((mega, index) => {
                if (mega.id == "unclassified") {
                    unclassifiedIdx = index;
                } else {
                    mega.major_proc_list.forEach(major => {
                        subProcList = [...subProcList, ...major.sub_proc_list];
                    });
                }
            })
            if (subProcList.length > 0) {
                subProcList = subProcList.map(sub => sub.id);
                const backend = BackendFactory.createBackend();
                let definitions = await backend.listDefinition();
                definitions = definitions.filter(definition => !subProcList.includes(definition.id));
                if (definitions.length > 0) {
                    definitions = definitions.map(definition => { return { id: definition.id, name: definition.name } });
                    if (unclassifiedIdx == -1) {
                        this.value.mega_proc_list.push({
                            id: "unclassified",
                            name: "미분류",
                            major_proc_list: [{
                                id: "unclassified_major",
                                name: "미분류",
                                sub_proc_list: definitions,
                            }],
                        })
                    } else {
                        this.value.mega_proc_list[unclassifiedIdx].major_proc_list = [{
                            id: "unclassified_major",
                            name: "미분류",
                            sub_proc_list: definitions,
                        }];
                    }
                }
            }
        },
    },
}
</script>

<style>
.add-process-card-hover:hover {
    background-color: rgb(33, 150, 243, 0.1)
}
</style>
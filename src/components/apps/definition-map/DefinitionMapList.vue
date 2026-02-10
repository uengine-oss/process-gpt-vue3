<template>
    <div class="pa-5">
        <draggable v-if="enableEdit" class="v-row dragArea list-group" :list="value.mega_proc_list" :animation="200"
            ghost-class="ghost-card" group="megaProcess" :draggable="'.draggable-item'">
            <transition-group>
                <v-col v-for="item in filteredValue.mega_proc_list" :key="item.id" class="cursor-pointer draggable-item"
                    cols="12" md="3" sm="6"
                    :min-width="200"
                    v-show="!visibleMegaIds || visibleMegaIds.has(item.id)"
                >
                    <MegaProcess :value="item" :parent="value" :enableEdit="enableEdit"  @clickProcess="clickProcess" :isExecutionByProject="isExecutionByProject" @clickPlayBtn="clickPlayBtn" :domains="domains" :selectedDomain="selectedDomain" :filteredProcDefIds="filteredProcDefIds"/>
                </v-col>
                <!-- MegaProcess 추가 카드 -->
                <v-col v-if="selectedDomain || isPalUengine" key="add-mega-card" class="cursor-pointer" cols="12" md="3" sm="3">
                    <v-card v-if="!processDialogStatus"
                        @click="openProcessDialog('add')"
                        class="cp-add-mega"
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
            <v-col v-for="item in filteredValue.mega_proc_list" :key="item.id" class="cursor-pointer" cols="12" md="3" sm="6"
                v-show="!visibleMegaIds || visibleMegaIds.has(item.id)"
            >
                <MegaProcess :value="item" :parent="value" :enableEdit="enableEdit" @clickProcess="clickProcess" :isExecutionByProject="isExecutionByProject" @clickPlayBtn="clickPlayBtn" :domains="domains" :selectedDomain="selectedDomain" :filteredProcDefIds="filteredProcDefIds"/>
            </v-col>
        </v-row>
        <v-dialog v-model="permissionDialogStatus" max-width="500" persistent>
            <permission-dialog
                :processMap="value"
                :procDef="permissionProcess"
                @close:permissionDialog="closePermissionDialog"
            />
        </v-dialog>
    </div>
</template>

<script>
import MegaProcess from './MegaProcess.vue';
import ProcessDialog from './ProcessDialog.vue';
import BaseProcess from './BaseProcess.vue'
import PermissionDialog from './PermissionDialog.vue'
import BackendFactory from '@/components/api/BackendFactory';

export default {
    components: {
        MegaProcess,
        ProcessDialog,
        PermissionDialog
    },
    mixins:[BaseProcess],
    props: {
        value: Object,
        enableEdit: Boolean,
        isExecutionByProject: Boolean,
        domains: Array,
        selectedDomain: String,
        filteredProcDefIds: Array,  // null = no filter, [] = filter active but no matches
        searchQuery: {
            type: String,
            default: ''
        }
    },
    computed: {
        isPalUengine() {
            return typeof window !== 'undefined' && window.$pal && window.$mode === 'uEngine';
        },
        // 검색어로 필터링된 값 반환
        filteredValue() {
            if (!this.searchQuery || !this.searchQuery.trim()) {
                return this.value;
            }
            
            const query = this.searchQuery.toLowerCase().trim();
            const filtered = JSON.parse(JSON.stringify(this.value)); // deep copy
            
            if (!filtered || !filtered.mega_proc_list) {
                return filtered;
            }
            
            // mega_proc_list 필터링
            filtered.mega_proc_list = filtered.mega_proc_list.map(megaProc => {
                const filteredMajorList = [];
                
                if (megaProc.major_proc_list) {
                    megaProc.major_proc_list.forEach(majorProc => {
                        if (majorProc.sub_proc_list) {
                            // sub_proc_list에서 검색어가 포함된 프로세스만 필터링
                            const filteredSubList = majorProc.sub_proc_list.filter(subProc => {
                                return subProc.name && subProc.name.toLowerCase().includes(query);
                            });
                            
                            // 필터링된 sub_proc_list가 있으면 majorProc 유지
                            if (filteredSubList.length > 0) {
                                filteredMajorList.push({
                                    ...majorProc,
                                    sub_proc_list: filteredSubList
                                });
                            }
                        }
                    });
                }
                
                // 필터링된 major_proc_list가 있으면 megaProc 유지
                if (filteredMajorList.length > 0) {
                    return {
                        ...megaProc,
                        major_proc_list: filteredMajorList
                    };
                }
                return null;
            }).filter(Boolean); // null 제거
            
            return filtered;
        },
        // metrics 구조 상 모든 Domain은 같은 MegaProcess를 가지고 있어야함
        // 모든 MegaProcess를 항상 표시
        visibleMegaIds() {
            // 항상 null 반환하여 모든 MegaProcess 표시
            return null;
        }
    },
    data: () => ({
        processType: '',
        processRenderer: 0
    }),
    created() {
        this.classifyProcess();
    },
    mounted() {
        this.EventBus.on('openPermissionDialog', (process) => {
            this.permissionProcess = process;
            this.permissionDialogStatus = true;
        });
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
            // 같은 레벨에 동일한 이름이 있는지 검증
            const isDuplicate = this.value.mega_proc_list.some(
                item => item.name.toLowerCase() === newProcess.name.toLowerCase()
            );
            if (isDuplicate) {
                this.$toast.error(this.$t('processDefinitionMap.duplicateName') || '동일한 이름의 프로세스가 이미 존재합니다.');
                return;
            }
            
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
            if (!this.value.mega_proc_list || this.value.mega_proc_list.length == 0) {
                this.value.mega_proc_list = [];
                return;
            }
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
                const listDefinition = await backend.listDefinition();
                let definitions = [];
                
                const addChildDefinitions = async (parentDefinition) => {
                    parentDefinition.id = parentDefinition.path;
                    definitions.push(parentDefinition);

                    if(parentDefinition.directory){
                        const childDefinitions = await backend.listDefinition(parentDefinition.path);
                        for (const child of childDefinitions) {
                            await addChildDefinitions(child);
                        }
                    }

                };

                for(const definition of listDefinition){
                    await addChildDefinitions(definition);
                }

                definitions = definitions.filter(definition => !subProcList.includes(definition.id) && definition.path.includes('.bpmn'));
                
                if (definitions.length > 0) {
                    definitions = definitions.map(definition => { return { id: definition.id, name: definition.name, path: definition.path } });
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
        clickProcess(id) {
            this.$emit('clickProcess', id);
        },
        clickPlayBtn(value){
            this.$emit('clickPlayBtn', value)
        }
    },
}
</script>
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
                <!-- MegaProcess 추가 카드: 특정 도메인 탭에서만 표시 -->
                <v-col v-if="selectedDomain" key="add-mega-card" class="cursor-pointer" cols="12" md="3" sm="3">
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
        selectedDomain: [String, Number],
        filteredProcDefIds: Array  // null = no filter, [] = filter active but no matches
    },
    computed: {
        // 미분류 Mega Process를 항상 마지막에 위치시킴
        filteredValue() {
            if (!this.value || !this.value.mega_proc_list) return this.value;

            const uncategorizedNames = ['미분류', 'Uncategorized', 'unclassified'];
            const sortedList = [...this.value.mega_proc_list].sort((a, b) => {
                const aIsUncategorized = uncategorizedNames.includes(a.name) || uncategorizedNames.includes(a.id);
                const bIsUncategorized = uncategorizedNames.includes(b.name) || uncategorizedNames.includes(b.id);

                if (aIsUncategorized && !bIsUncategorized) return 1;  // a를 뒤로
                if (!aIsUncategorized && bIsUncategorized) return -1; // b를 뒤로
                return 0; // 순서 유지
            });

            return {
                ...this.value,
                mega_proc_list: sortedList
            };
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
        // 미분류 처리는 ProcessDefinitionMap.vue의 updateUncategorizedProcesses()에서 담당

        // 다른 곳에서 프로세스 다이얼로그가 열리면 자신의 다이얼로그 닫기
        this._processDialogId = Math.random().toString(36).substr(2, 9);
        this._closeDialogHandler = (event) => {
            if (event.detail !== this._processDialogId) {
                this.processDialogStatus = false;
            }
        };
        window.addEventListener('closeAllProcessDialogs', this._closeDialogHandler);
    },
    mounted() {
        this.EventBus.on('openPermissionDialog', (process) => {
            this.permissionProcess = process;
            this.permissionDialogStatus = true;
        });
    },
    beforeUnmount() {
        window.removeEventListener('closeAllProcessDialogs', this._closeDialogHandler);
    },
    watch: {
        // 미분류 처리는 ProcessDefinitionMap.vue의 updateUncategorizedProcesses()에서 담당
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
        clickProcess(id) {
            this.$emit('clickProcess', id);
        },
        clickPlayBtn(value){
            this.$emit('clickPlayBtn', value)
        }
    },
}
</script>
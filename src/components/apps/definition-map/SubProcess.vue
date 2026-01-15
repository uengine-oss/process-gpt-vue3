<template>
    <div class="align-center pa-2 cursor-pointer sub-process-hover sub-process-style pr-3 pl-3">
        <h6 v-if="!processDialogStatus || processType === 'add'" class="text-subtitle-2 font-weight-semibold">
            <v-row class="ma-0 pa-0 align-center">
                <div  @click="handleClick"
                    class="ma-0 pa-0 d-flex align-center"
                    style="flex: 1; min-width: 0; gap: 4px;"
                >
                    <div>{{ value.name }}</div>
                    
                        <!-- v-if="value.new" -->
                    <v-chip v-if="isNew(value.id) && !enableEdit" 
                        color="primary"
                        variant="outlined"
                        size="x-small"
                    >New</v-chip>
                </div>
                <div class="ml-auto add-sub-process" style="flex-shrink: 0;">
                    <v-btn 
                        v-if="isExecutionByProject" 
                        variant="elevated" 
                        color="primary" 
                        size="x-small" 
                        @click="clickPlayBtn()" 
                        class="rounded-pill"
                    >
                        {{ $t('SubProcess.execute') }}
                    </v-btn>
                    <ProcessMenu
                        :size="16"
                        :type="type"
                        :process="value"
                        :enableEdit="enableEdit"
                        @delete="deleteProcess"
                        @editProcessdialog="editProcessdialog"
                        @modeling="editProcessModel"
                        @setPermission="openPermissionDialog(value)"
                        @duplicate="duplicateProcess"
                    />
                </div>
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
    </div>
</template>

<script>
import ProcessMenu from './ProcessMenu.vue';
import ProcessDialog from './ProcessDialog.vue'
import BaseProcess from './BaseProcess.vue';
import BackendFactory from '@/components/api/BackendFactory';

export default {
    components: {
        ProcessMenu,
        ProcessDialog,
    },
    mixins: [BaseProcess],
    props: {
        value: Object,
        parent: Object,
        enableEdit: Boolean,
        isExecutionByProject: Boolean
    },
    data: () => ({
        type: 'sub',
        definition: null,
        checkedProcess: [],
    }),
    async created() {
        this.checkedProcess = JSON.parse(localStorage.getItem('checkedProcess')) || [];

        // 다른 곳에서 프로세스 다이얼로그가 열리면 자신의 다이얼로그 닫기
        this._processDialogId = Math.random().toString(36).substr(2, 9);
        this._closeDialogHandler = (event) => {
            if (event.detail !== this._processDialogId) {
                this.processDialogStatus = false;
            }
        };
        window.addEventListener('closeAllProcessDialogs', this._closeDialogHandler);
    },
    beforeUnmount() {
        window.removeEventListener('closeAllProcessDialogs', this._closeDialogHandler);
    },
    methods: {
        isNew(id) {
            return !this.checkedProcess.includes(id);
        },
        handleClick() {
            if(this.isExecutionByProject) return;
            
            if (window.$mode == 'ProcessGPT') {
                this.goProcess(this.value.id, 'sub');
            } else {
                this.$emit('clickProcess', this.value.path);
            }
            if(!this.checkedProcess.includes(this.value.id)) {
                this.checkedProcess.push(this.value.id);
                localStorage.setItem('checkedProcess', JSON.stringify(this.checkedProcess));
            }
        },
        deleteProcess() {
            this.parent.sub_proc_list = this.parent.sub_proc_list.filter(item => item.id != this.value.id);
        },
        async editProcessModel() {
            const id = this.value.id.replace(/ /g, '_')
            const backend = BackendFactory.createBackend();
            const value = await backend.getRawDefinition(id);
            let url;
            if (value && value.id) {
                url = `/definitions/${value.id}?modeling=true`;
            } else {
                url = `/definitions/chat?id=${id}&name=${this.value.name}&modeling=true`;
            }
            window.open(url, '_blank');
        },
        clickPlayBtn(){
            this.$emit('clickPlayBtn', this.value)
        },
        async duplicateProcess(process) {
            try {
                const backend = BackendFactory.createBackend();

                // Generate unique name with copy suffix
                let baseName = process.name;
                let newName = `${baseName} (${this.$t('ProcessMenu.copySuffix') || '복사'})`;

                // 원본 프로세스 정의(BPMN XML) 가져오기
                const originalDef = await backend.getRawDefinition(process.id, null);
                const bpmn = originalDef?.bpmn || '';
                const definition = originalDef?.definition || null;

                // duplicateLocalProcess 사용 (ID는 _copy 형태로 자동 생성)
                const result = await backend.duplicateLocalProcess(
                    process.id,
                    newName,
                    bpmn,
                    definition
                );

                if (result.success) {
                    // Add to parent's sub_proc_list
                    const newProcess = {
                        id: result.newId,
                        name: newName
                    };
                    this.parent.sub_proc_list.push(newProcess);

                    this.$toast.success(this.$t('ProcessMenu.duplicateSuccess') || '프로세스가 복사되었습니다.');
                } else {
                    throw new Error('Duplication failed');
                }
            } catch (error) {
                console.error('프로세스 복제 중 오류:', error);
                this.$toast.error(this.$t('ProcessMenu.duplicateFailed') || '프로세스 복사에 실패했습니다.');
            }
        }
    },
}
</script>

<style scoped>
.sub-process-style {
    background-color: transparent;
    padding:5px;
    border-radius:8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* 연한 그림자 추가 */
}
.sub-process-hover:hover {
    background-color:#E7ECF0 !important;
}
</style>
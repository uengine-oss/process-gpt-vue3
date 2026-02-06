<template>
    <div class="align-center pa-2 cursor-pointer sub-process-hover sub-process-style pr-3 pl-3">
        <h6 v-if="!processDialogStatus || processType === 'add'" class="text-subtitle-2 font-weight-semibold">
            <v-row class="ma-0 pa-0 align-center">
                <div  @click="handleClick"
                    @dblclick="handleDoubleClick"
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
        handleDoubleClick() {
            if (this.isExecutionByProject) return;
            if (window.$mode === 'uEngine') {
                const path = this.value.id ?? this.value.path;
                if (path) this.goProcess(path, 'sub');
            }
        },
        deleteProcess() {
            this.parent.sub_proc_list = this.parent.sub_proc_list.filter(item => item.id != this.value.id);
            
            // 성공 메시지 표시
            if (window.$app_) {
                window.$app_.snackbarMessage = this.$t('successMsg.delete');
                window.$app_.snackbarColor = 'success';
                window.$app_.snackbar = true;
                window.$app_.snackbarSuccessStatus = true;
            }
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
        duplicateProcess(process) {
            // Generate unique name with copy suffix
            let baseName = process.name;
            let newName = `${baseName} (${this.$t('ProcessMenu.copySuffix') || '복사'})`;
            let counter = 1;

            // Check for duplicate names
            while (this.parent.sub_proc_list.some(item => item.name === newName)) {
                newName = `${baseName} (${this.$t('ProcessMenu.copySuffix') || '복사'} ${counter++})`;
            }

            // Generate unique ID based on original ID with _duplicate suffix
            let baseId = process.id;
            let newId = `${baseId}_duplicate`;
            let idCounter = 1;

            // Check for duplicate IDs
            while (this.parent.sub_proc_list.some(item => item.id === newId)) {
                newId = `${baseId}_duplicate${idCounter++}`;
            }

            // Create new process with unique ID
            const newProcess = {
                id: newId,
                name: newName
            };

            // Add to parent's sub_proc_list
            this.parent.sub_proc_list.push(newProcess);

            this.$toast.success(this.$t('ProcessMenu.duplicateSuccess') || '프로세스가 복사되었습니다.');
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
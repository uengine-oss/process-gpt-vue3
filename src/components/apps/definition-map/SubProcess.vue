<template>
    <div class="align-center pa-2 cursor-pointer sub-process-hover sub-process-style pr-3 pl-3">
        <h6 v-if="!processDialogStatus || processType === 'add'" class="text-subtitle-2 font-weight-semibold">
            <v-row class="ma-0 pa-0">
                <v-col :cols="enableEdit ? '6' : '12'" class="ma-0 pa-0 text-left align-center" @click="handleClick">
                    <v-row class="ma-0 pa-0 align-center">
                        <div>{{ value.name }}</div>
                       
                        <div class="ml-auto">
                             <!-- v-if="value.new" -->
                             <v-chip v-if="isNew(value.id)" 
                                class="ml-auto"
                                color="primary"
                                variant="outlined"
                                size="x-small"
                            >New</v-chip>
                            <Icons v-if="isExecutionByProject" :icon="'play'" :size="20" @click="clickPlayBtn()" style="align-self: center;"/>
                        </div>
                       
                    </v-row>
                </v-col>
                <v-col :cols="enableEdit ? '6' : ''" class="ma-0 pa-0">
                <div class="ml-auto add-sub-process">
                    <ProcessMenu
                        :size="16"
                        :type="type"
                        :process="value"
                        :enableEdit="enableEdit"
                        @delete="deleteProcess"
                        @editProcessdialog="editProcessdialog"
                        @modeling="editProcessModel"
                        @setPermission="openPermissionDialog(value)"
                    />
                </div>
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
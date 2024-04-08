<template>
    <div>
        <div class="d-flex">
            <v-btn icon variant="text" :width="size" :height="size">
                <!-- <PlusIcon v-if="type == 'map'" :size="size" /> -->
                <DotsVerticalIcon v-if="enableEdit && type != 'map'" :size="size" />
                <v-menu activator="parent">
                    <v-list density="compact" class="cursor-pointer">
                        <v-list-item v-if="type != 'sub'" @click="openDialog('add')">
                            <v-list-item-title class="cp-process">
                                <span v-if="addType != 'sub'">{{ addType.toUpperCase() }}</span> 프로세스 추가
                            </v-list-item-title>
                        </v-list-item>
                        <v-list-item v-else @click="editProcess">
                            <v-list-item-title>
                                프로세스 편집
                            </v-list-item-title>
                        </v-list-item>
                        <v-list-item v-if="type != 'map'" @click="openDialog('update')">
                            <v-list-item-title>
                                수정
                            </v-list-item-title>
                        </v-list-item>
                        <v-list-item v-if="type != 'map'" @click="deleteProcess">
                            <v-list-item-title>
                                삭제
                            </v-list-item-title>
                        </v-list-item>
                        <v-list-item class="cp-mega-datail" v-if="type == 'mega'" @click="openViewProcessDetails(process)">
                            <v-list-item-title>
                                상세보기
                            </v-list-item-title>
                        </v-list-item>
                        <v-list-item class="cp-mega-datail" v-if="type == 'mega'" @click="openViewProcessDetails(process)">
                            <v-list-item-title>
                                실행
                            </v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-menu>
            </v-btn>
        </div>
        
        <ProcessDialog
            :enableEdit="enableEdit"
            :process="process"
            :processDialogStatus="processDialogStatus"
            :definitions="definitions"
            :processType="processType"
            :type="type"
            @add="addProcess"
            @edit="updateProcess"
            @closeProcessDialog="closeProcessDialog"
        />
    </div>
</template>

<script>
import ProcessDialog from './ProcessDialog.vue'
import FormMapper from '@/components/designer/mapper/FormMapper.vue'; 


export default {
    components: {
        ProcessDialog,
        FormMapper,
    },
    props: {
        size: Number,
        type: String,
        process: Object,
        storage: Object,
        enableEdit: Boolean,
    },
    data: () => ({
        formMapperDialog: false,
        newProcess: {
            id: "",
            label: ""
        },
        definitions: null,
        processDialogStatus: false,
        processType:"",
    }),
    computed: {
        addType() {
            if (this.type == 'map') {
                return "mega";
            } else if (this.type == 'mega') {
                return "major";
            } else if (this.type == 'major') {
                return "sub";
            }
        },
    },
    watch: {
    },
    created() {
        this.init();
    },
    methods: {
        async init() {
            if (this.addType == 'sub') {
                const list = await this.storage.list(`proc_def`);
                if (list && list.length > 0) {
                    this.definitions = list;
                } else {
                    this.definitions = null;
                }
            }
        },
        openViewProcessDetails(process) {
            this.$router.push(`/definition-map/mega/${process.id}`);
        },
        openDialog(processType) {
            this.processType = processType;
            this.processDialogStatus = true;
        },
        deleteProcess() {
            this.$emit("delete");
        },
        editProcess() {
            this.$emit("modeling");
        },
        addProcess(newProcess) {
            this.$emit("add", newProcess);
            this.processDialogStatus = false;
        },
        updateProcess(newProcess) {
            this.$emit("edit", newProcess);
            this.processDialogStatus = false;
        },
        closeProcessDialog() {
            this.processDialogStatus = false;
        },
    },
}
</script>
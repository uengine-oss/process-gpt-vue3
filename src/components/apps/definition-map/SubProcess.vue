<template>
    <div class="align-center pa-2 cursor-pointer sub-process-hover sub-process-style pr-3 pl-3" @click="viewProcess">
        <h6 v-if="!processDialogStatus || processType === 'add'" class="text-subtitle-2 font-weight-semibold">
            <v-row class="ma-0 pa-0">
                <v-col cols="6" class="ma-0 pa-0 text-left align-center">
                    <div>{{ value.label }}</div>
                </v-col>
                <v-col cols="6" class="ma-0 pa-0">
                <div class="ml-auto add-sub-process">
                    <ProcessMenu
                        :size="16"
                        :type="type"
                        :process="value"
                        :enableEdit="enableEdit"
                        @delete="deleteProcess"
                        @editProcessdialog="editProcessdialog"
                        @modeling="editProcessModel"
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
        ProcessDialog
    },
    mixins: [BaseProcess],
    props: {
        value: Object,
        parent: Object,
        enableEdit: Boolean,
        enableExecution: Boolean
    },
    data: () => ({
        type: 'sub',
        definition: null,
    }),
    async created() {
    },
    methods: {
        deleteProcess() {
            this.parent.sub_proc_list = this.parent.sub_proc_list.filter(item => item.id != this.value.id);
        },
        async editProcessModel() {
            const backend = BackendFactory.createBackend();
            this.definition = await backend.getRawDefinition(this.value.id);
            let url;
            if (this.definition && this.definition.id) {
                url = `/definitions/${this.definition.id}`;
            } else {
                url = `/definitions/chat?id=${this.value.id}&name=${this.value.label}`;
            }
            window.open(url, '_blank'); // '_blank'는 새 탭에서 열기
        },
    },
}
</script>

<style scoped>
.sub-process-style {
    background-color: transparent;
    padding:5px;
    border-radius:8px;
}
.sub-process-hover:hover {
    background-color:#E7ECF0 !important;
}
</style>
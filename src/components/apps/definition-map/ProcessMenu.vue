<template>
    <div>
        <v-row class="ma-0 pa-0">
            <v-spacer></v-spacer>
            <div v-if="enableEdit" class="proc-menu-btn-box">
                <v-tooltip v-if="type == 'sub'" text="프로세스 편집">
                    <template v-slot:activator="{ props }">
                        <v-btn @click="editProcess"
                            icon v-bind="props"
                            density="compact"
                            size="small"
                        >
                            <Icon icon="tabler:pencil-cog" width="16" height="16" />
                        </v-btn>
                    </template>
                </v-tooltip>
                <v-tooltip v-if="type != 'map'" text="수정">
                    <template v-slot:activator="{ props }">
                        <v-btn @click="openEditDialog('update')"
                            icon v-bind="props"
                            density="compact"
                            size="small"
                        >
                            <Icon icon="oi:pencil" />
                        </v-btn>
                    </template>
                </v-tooltip>
                <v-tooltip v-if="type != 'map'" text="삭제">
                    <template v-slot:activator="{ props }">
                        <v-btn @click="deleteProcess"
                            icon v-bind="props"
                            density="compact"
                            size="small"
                        >
                            <Icon icon="el:trash" />
                        </v-btn>
                    </template>
                </v-tooltip>
            </div>
            <!-- <div v-else-if="enableExecution" icon variant="text" :width="size" :height="size">
                <v-list density="compact" class="cursor-pointer">
                    <v-btn @click="executeProcessDialog">
                            프로세스 실행
                    </v-btn>
                </v-list>
            </div> -->
        </v-row>
    </div>
</template>

<script>
import ProcessDialog from './ProcessDialog.vue'


export default {
    components: {
        ProcessDialog,
    },
    props: {
        size: Number,
        type: String,
        process: Object,
        // storage: Object,
        enableEdit: Boolean,
        enableExecution: Boolean,
    },
    data: () => ({
        newProcess: {
            id: "",
            label: ""
        },
        processDialogStatus: false,
        processType: "",
        // executeProcessDialog: false
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
    },
    methods: {
        // executeProcessDialog() {
        //     this.executeProcessDialog = true;
        // },
        openViewProcessDetails(process) {
            this.$router.push(`/definition-map/mega/${process.id}`);
        },
        openEditDialog(processType) {
            this.$emit('editProcessdialog', processType);
        },
        deleteProcess() {
            this.$emit("delete");
        },
        editProcess() {
            this.$emit("modeling");
        },
    },
}
</script>
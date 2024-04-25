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
        enableEdit: Boolean,
    },
    data: () => ({
        newProcess: {
            id: "",
            label: ""
        },
        processDialogStatus: false,
        processType: "",
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
<template>
    <div>
        <div v-if="enableEdit" class="proc-menu-btn-box">
            <v-tooltip text="권한 설정">
                <template v-slot:activator="{ props }">
                    <v-btn @click.stop="setPermission"
                        icon v-bind="props"
                        density="compact"
                        size="small"
                    >
                        <Icons :icon="'user-lock'" :width="14" :height="14"  />
                    </v-btn>
                </template>
            </v-tooltip>
            <v-tooltip v-if="type == 'sub'" text="프로세스 편집">
                <template v-slot:activator="{ props }">
                    <v-btn @click.stop="editProcess"
                        icon v-bind="props"
                        density="compact"
                        size="small"
                    >
                        <Icons :icon="'pencil-cog'" :width="12" :height="12"  />
                    </v-btn>
                </template>
            </v-tooltip>
            <v-tooltip v-if="type != 'map'" text="수정">
                <template v-slot:activator="{ props }">
                    <v-btn @click.stop="openEditDialog('update')"
                        icon v-bind="props"
                        density="compact"
                        size="small"
                    >
                        <Icons :icon="'pencil'" :width="12" :height="12" />
                    </v-btn>
                </template>
            </v-tooltip>
            <v-tooltip v-if="type != 'map'" text="삭제">
                <template v-slot:activator="{ props }">
                    <v-btn @click.stop="deleteProcess"
                        icon v-bind="props"
                        density="compact"
                        size="small"
                    >
                        <Icons :icon="'trash'" :width="12" :height="12" />
                    </v-btn>
                </template>
            </v-tooltip>
        </div>
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
        isPal() {
            return window.$pal;
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
        setPermission() {
            this.$emit("setPermission", this.process);
        },
    },
}
</script>
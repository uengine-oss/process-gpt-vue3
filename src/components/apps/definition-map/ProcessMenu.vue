<template>
    <div>
        <div v-if="enableEdit" class="proc-menu-btn-box text-right">
            <!-- Add button for mega/major types: 특정 도메인 탭에서만 표시 -->
            <v-tooltip v-if="(type === 'mega' || type === 'major') && selectedDomain" :text="addTooltipText">
                <template v-slot:activator="{ props }">
                    <v-btn @click.stop="addProcess"
                        icon v-bind="props"
                        density="compact"
                        size="small"
                    >
                        <v-icon size="14">mdi-plus</v-icon>
                    </v-btn>
                </template>
            </v-tooltip>
            <v-tooltip v-if="isPal" :text="$t('ProcessMenu.setPermission')">
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
            <v-tooltip v-if="type != 'map' && type != 'sub'" :text="$t('ProcessMenu.edit')">
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
            <v-tooltip v-if="type === 'sub'" :text="$t('ProcessMenu.duplicate')">
                <template v-slot:activator="{ props }">
                    <v-btn @click.stop="duplicateProcess"
                        icon v-bind="props"
                        density="compact"
                        size="small"
                    >
                        <v-icon size="12">mdi-content-copy</v-icon>
                    </v-btn>
                </template>
            </v-tooltip>
            <v-tooltip v-if="type != 'map'" :text="$t('ProcessMenu.delete')">
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
        selectedDomain: String,
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
        addTooltipText() {
            if (this.type === 'mega') {
                return this.$t('processDefinitionMap.addMajor');
            } else if (this.type === 'major') {
                return this.$t('processDefinitionMap.addSub');
            }
            return '';
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
        duplicateProcess() {
            this.$emit("duplicate", this.process);
        },
        addProcess() {
            this.$emit("add");
        },
    },
}
</script>
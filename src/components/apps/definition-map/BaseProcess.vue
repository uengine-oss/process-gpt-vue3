<template>
    <div>
    </div>
</template>

<script>
export default {
    components: {
    },
    props: {
    },
    data: () => ({
        processDialogStatus: false,
        permissionDialogStatus: false,
        hover: false,
    }),
    methods: {
        closePermissionDialogStatus(newStatus) {
            this.permissionDialogStatus = newStatus;
        },
        openSetPermissionDialog() {
            this.permissionDialogStatus = true;
        },
        editProcess(process) {
            this.value.id = process.id;
            this.value.label = process.label
            this.value.name = process.name
        },
        editProcessdialog(processType) {
            if (this.processDialogStatus) {
                this.processDialogStatus = false;
            }
            this.processType = processType;
            this.processDialogStatus = true;
        },
        openProcessDialog(processType) {
            if (this.processDialogStatus) {
                this.processDialogStatus = false;
            }
            this.processType = processType;
            this.processDialogStatus = true;
        },
        closeProcessDialog() {
            this.processDialogStatus = false;
        },
        goProcess(path, type) {
            if (this.enableEdit) {
                return;
            }
            if (!path && !type) {
                this.$router.push(`/definition-map`);
            } else {
                const encodedPath = encodeURIComponent(path);
                this.$router.push(`/definition-map/${type}/${encodedPath}`)
            }
        },
        
    },
}
</script>
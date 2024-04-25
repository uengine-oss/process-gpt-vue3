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
        hover: false,
    }),
    methods: {
        async editProcess(process) {
            this.value.id = process.id;
            this.value.label = process.label
        },
        editProcessdialog(processType) {
            this.processType = processType;
            this.processDialogStatus = true;
        },
        openProcessDialog(processType) {
            this.processType = processType;
            this.processDialogStatus = true;
        },
        closeProcessDialog() {
            this.processDialogStatus = false;
        },
        goProcess(path, type) {
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
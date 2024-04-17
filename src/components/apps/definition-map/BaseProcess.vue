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
    }),
    methods: {
        async editProcess(process) {
            this.value.id = process.id;
            this.value.label = process.label
            if (this.type === 'sub') {
                const updateValue = {
                    id: process.id,
                    name: process.label
                };

                await this.storage.putObject(`proc_def/${process.id}`, updateValue);
            }
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
        }
    },
}
</script>
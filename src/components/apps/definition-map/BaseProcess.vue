<template>
    <div>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
    },
    props: {
    },
    data: () => ({
        processDialogStatus: false,
        permissionDialogStatus: false,
        hover: false,
        permissionProcess: null,
        permissionProcessMap: null,
    }),
    methods: {
        closePermissionDialog() {
            this.permissionProcess = null;
            this.permissionDialogStatus = false;
        },
        openPermissionDialog(process) {
            this.EventBus.emit('openPermissionDialog', process);
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
        async goProcess(path, type) {
            if (this.enableEdit) {
                return;
            }
            // if (!path && !type) {
            //     this.$router.push(`/definition-map`);
            // } else {
            //     const encodedPath = encodeURIComponent(path);
            //     this.$router.push(`/definition-map/${type}/${encodedPath}`)
            // }

            
            const id = this.value.id.replace(/ /g, '_')
            const value = await backend.getRawDefinition(id);
            let url;
            if(type) {
                if (value && value.id) {
                    url = `/definition-map/${type}/${value.id}`;
                }
            }
            this.$router.push(url)
        },
        async addProcessPermission(procDef) {
            const uid = localStorage.getItem('uid');
            await backend.putUserPermission({
                user_id: uid,
                proc_def_id: procDef.id,
                proc_def_ids: this.permissionProcessMap,
                readable: true,
                writable: true
            });
        },
        async checkPermission(id) {
            const uid = localStorage.getItem('uid');
            const options = {
                proc_def_id: id,
                user_id: uid
            }
            const permissions = await backend.getUserPermissions(options);
            return permissions;
        }
    },
}
</script>
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
        findMatchingProcess(procDef, processMap) {
            function searchInList(list, targetId) {
                for (const item of list) {
                    if (item.id === targetId) {
                        return item;
                    }
                    if (item.major_proc_list) {
                        const found = searchInList(item.major_proc_list, targetId);
                        if (found) {
                            return { ...item, major_proc_list: [found] };
                        }
                    }
                    if (item.sub_proc_list) {
                        const found = searchInList(item.sub_proc_list, targetId);
                        if (found) {
                            return { ...item, sub_proc_list: [found] };
                        }
                    }
                }
                return null;
            }
            const targetId = procDef.sub_proc_list ? procDef.id : procDef.id;
            return searchInList(processMap.mega_proc_list, targetId);
        },
        getMatchingProcessMap(procDef, processMap) {
            const matchingProcess = this.findMatchingProcess(procDef, processMap);
            return matchingProcess;
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
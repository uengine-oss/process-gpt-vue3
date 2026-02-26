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
        processType: '',
        permissionDialogStatus: false,
        hover: false,
        permissionProcess: null,
        permissionProcessMap: null,
        editable: false,
    }),
    created() {
        // 다른 곳에서 프로세스 다이얼로그가 열리면 자신의 다이얼로그 닫기
        this._processDialogId = Math.random().toString(36).substr(2, 9);
        this._closeDialogHandler = (event) => {
            if (event.detail !== this._processDialogId) {
                this.processDialogStatus = false;
            }
        };
        window.addEventListener('closeAllProcessDialogs', this._closeDialogHandler);
    },
    async mounted() {
        const role = localStorage.getItem('role');
        if (role == 'superAdmin') {
            this.editable = true;
        } else {
            if(this.process) {
                const uid = localStorage.getItem('uid');
                const permission = await backend.getUserPermissions({ proc_def_id: this.process.id, user_id: uid });
                if (permission) {
                    this.editable = permission.writable;
                } else {
                    this.editable = false;
                }
            }
        }
    },
    beforeUnmount() {
        window.removeEventListener('closeAllProcessDialogs', this._closeDialogHandler);
    },
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
            // 다른 모든 다이얼로그 닫기
            window.dispatchEvent(new CustomEvent('closeAllProcessDialogs', { detail: this._processDialogId }));
            this.processType = processType;
            this.processDialogStatus = true;
        },
        openProcessDialog(processType) {
            // 다른 모든 다이얼로그 닫기
            window.dispatchEvent(new CustomEvent('closeAllProcessDialogs', { detail: this._processDialogId }));
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
            if (!path && !type) {
                this.$router.push(`/definition-map`);
            } else {
                this.$router.push(`/definition-map/${type}/${path}`)
            }

            // const id = this.value.id.replace(/ /g, '_')
            // const value = await backend.getRawDefinition(id);
            // let url;
            // if(type) {
            //     if (value && value.id) {
            //         url = `/definition-map/${type}/${value.id}`;
            //     }
            // }
            // this.$router.push(url)
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
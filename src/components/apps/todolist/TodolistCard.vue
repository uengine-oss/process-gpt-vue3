<template>
    <v-card elevation="10">
        <div class="pa-5">
            <div class="d-flex align-center justify-space-between mb-7">
                <h5 class="text-h5 font-weight-semibold">{{ ($t('todoList.title')) }}</h5>
                
                <!-- ProcessGPTBackend -->
                <v-avatar 
                    size="24" 
                    elevation="10" 
                    class="bg-surface d-flex align-center cursor-pointer"
                    @click="openDialog" 
                >
                    <v-tooltip activator="parent" location="left">할 일 등록</v-tooltip>
                    <PlusIcon size="24" stroke-width="2" />
                </v-avatar>
            </div>

            <v-row>
                <v-col v-for="column in todolist" 
                    :key="column.id"
                    cols="12" 
                    md="3" 
                    sm="6" 
                    class="d-flex" 
                >
                    <TodoTaskColumn :column="column" />
                </v-col>
            </v-row>
        </div>

        <v-dialog v-model="dialog" max-width="500">
            <TodoDialog :todolist="todolist" @close="closeDialog" />
        </v-dialog>
    </v-card>
</template>

<script>
import TodoDialog from './TodoDialog.vue';
import TodoTaskColumn from './TodoTaskColumn.vue';

import BackendFactory from "@/components/api/BackendFactory";
const backend = BackendFactory.createBackend();

export default {
    components: {
        TodoTaskColumn,
        TodoDialog,
    },
    data: () => ({
        todolist: [
            {
                id: 'TODO',
                title: 'Todo',
                cardbg: 'background',
                tasks: []
            },
            {
                id: 'IN_PROGRESS',
                title: 'In Progress',
                cardbg: 'lightsecondary',
                tasks: []
            },
            {
                id: 'PENDING',
                title: 'Pending',
                cardbg: 'lightinfo',
                tasks: []
            },
            {
                id: 'DONE',
                title: 'Done',
                cardbg: 'lightsuccess',
                tasks: []
            }
        ],
        dialog: false,
    }),
    mounted() {
        var me = this;
        me.$try({
            action: async () => {
                me.todolist = await backend.getWorkList();
            },
        })
    },
    methods:{
        openDialog() {
            this.dialog = true;
        },
        closeDialog() {
            this.dialog = false;
        },
    },
}
</script>
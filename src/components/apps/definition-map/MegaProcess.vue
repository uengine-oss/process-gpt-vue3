<template>
    <div class="w-100">
        <v-card class="d-flex align-center pa-3 mb-3 bg-lightwarning"
            elevation="10"
            style="border-radius: 10px !important;
            background-color:#FFA726;"
        >
            <h6 class="text-h6 font-weight-semibold">
                {{ value.label }}
            </h6>
            <div class="ml-auto add-major-process">
                <ProcessMenu
                    :size="20"
                    :type="type"
                    :process="value"
                    :storage="storage"
                    :enableEdit="enableEdit"
                    @add="addProcess"
                    @edit="editProcess"
                    @delete="deleteProcess"
                />
            </div>
        </v-card>
        
        <draggable v-if="enableEdit"
            class="dragArea list-group" 
            :list="value.major_proc_list" 
            :animation="200" 
            ghost-class="ghost-card"
            group="majorProcess"
        >
            <transition-group>
                <div v-for="item in value.major_proc_list"
                    :key="item.id" 
                    class="cursor-pointer"
                >
                    <MajorProcess 
                        :value="item" 
                        :parent="value" 
                        :storage="storage" 
                        :userInfo="userInfo"
                        :enableEdit="enableEdit"
                        :enableExecution="enableExecution"
                        @view="viewProcess"
                    />
                </div>
            </transition-group>
        </draggable>
        <div v-else>
            <div v-for="item in value.major_proc_list"
                :key="item.id" 
            >
                <MajorProcess 
                    :value="item" 
                    :parent="value" 
                    :storage="storage" 
                    :userInfo="userInfo"
                    :enableEdit="enableEdit"
                    :enableExecution="enableExecution"
                    @view="viewProcess"
                />
            </div>
        </div>
    </div>
</template>

<script>
import ProcessMenu from './ProcessMenu.vue';
import MajorProcess from './MajorProcess.vue';

export default {
    components: {
        ProcessMenu,
        MajorProcess,
    },
    props: {
        value: Object,
        parent: Object,
        storage: Object,
        userInfo: Object,
        enableEdit: Boolean,
        enableExecution: Boolean
    },
    data: () => ({
        type: 'mega',
    }),
    created() {
    },
    methods:{
        addProcess(newProcess) {
            var newMajorProc = {
                id: newProcess.id,
                label: newProcess.label,
                sub_proc_list: [],
            };
            this.value.major_proc_list.push(newMajorProc);
            // this.storage.putObject(`proc_map`, this.value);
        },
        editProcess(process) {
            this.value.id = process.id;
            this.value.label = process.label;
        },
        deleteProcess() {
            this.parent.mega_proc_list = this.parent.mega_proc_list.filter(item => item.id != this.value.id);
        },
        viewProcess(process) {
            this.$emit('view', process);
        }
    },
}
</script>
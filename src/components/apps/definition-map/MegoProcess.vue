<template>
    <div class="w-100">
        <div class="d-flex align-center bg-lightwarning pa-3 mb-3">
            <h6 class="text-h6 font-weight-semibold">
                {{ value.label }}
            </h6>
            <div class="ml-auto">
                <ProcessMenu
                    :size="20"
                    :type="'mega'"
                    :process="value"
                    :storage="storage"
                    @add="addProcess"
                    @edit="editProcess"
                    @delete="deleteProcess"
                />
            </div>
        </div>
        
        <draggable class="dragArea list-group" 
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
                    />
                </div>
            </transition-group>
        </draggable>
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
    },
}
</script>
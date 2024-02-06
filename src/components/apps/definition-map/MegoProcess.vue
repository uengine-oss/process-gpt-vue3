<template>
    <div class="w-100">
        <div class="d-flex align-center bg-lightwarning pa-3 mb-3">
            <h6 class="text-h6 font-weight-semibold">
                {{ megaProcess.name }}
            </h6>
            <div class="ml-auto d-flex">
                <ProcessMenu :size="20" :type="'Major'" @add="addMajorProcess" />
            </div>
        </div>
        
        <draggable class="dragArea list-group" 
            :list="megaProcess.majorProcess" 
            :animation="200" 
            ghost-class="ghost-card"
            group="majorProcess"
        >
            <transition-group>
                <div v-for="process in megaProcess.majorProcess"
                    :key="process.name" 
                >
                    <MajorProcess :majorProcess="process" @updateProcess="updateProcess" />
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
        megaProcess: Object,
    },
    methods:{
        addMajorProcess(newProcess) {
            this.megaProcess.majorProcess.push(newProcess);

            this.updateProcess();
        },
        updateProcess() {
            this.$emit("updateProcess");
        },
        deleteMegaProcess() {
            //
        }
    },
}
</script>
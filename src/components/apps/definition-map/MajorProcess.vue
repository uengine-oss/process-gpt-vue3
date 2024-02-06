<template>
    <div class="mb-3">
        <div class="d-flex align-center bg-lightsecondary pa-3">
            <h6 class="text-subtitle-1 font-weight-semibold">
                {{ majorProcess.name }}
            </h6>
            <div class="ml-auto">
                <ProcessMenu :size="16" :type="'Sub'" @add="addSubProcess" @delete="deleteMajorProcess" />
            </div>
        </div>

        <draggable class="dragArea list-group" 
            :list="majorProcess.subProcess" 
            :animation="200" 
            ghost-class="ghost-card"
            group="subProcess"
        >
            <transition-group>
                <div v-for="process in majorProcess.subProcess"
                    :key="process.name" 
                >
                    <SubProcess :subProcess="process" />
                </div>
            </transition-group>
        </draggable>
    </div>
</template>

<script>
import ProcessMenu from './ProcessMenu.vue';
import SubProcess from './SubProcess.vue';

export default {
    components: {
        ProcessMenu,
        SubProcess,
    },
    props: {
        majorProcess: Object,
    },
    methods: {
        addSubProcess(newProcess) {
            this.majorProcess.subProcess.push(newProcess);

            this.updateProcess();
        },
        updateProcess() {
            this.$emit("updateProcess");
        },
        deleteMajorProcess() {
            this.updateProcess();
        },
    },
}
</script>
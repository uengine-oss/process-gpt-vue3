<template>
    <div class="mb-3">
        <v-card class="d-flex align-center bg-lightsecondary pa-3"
            elevation="10"
            style="border-radius: 10px !important; margin-bottom:5px;"
        >
            <h6 class="text-subtitle-1 font-weight-semibold">
                {{ value.label }}
            </h6>
            <div class="ml-auto add-sub-process">
                <ProcessMenu
                    :size="16"
                    :type="type"
                    :process="value"
                    :storage="storage"
                    :userInfo="userInfo"
                    :enableEdit="enableEdit"
                    @add="addProcess"
                    @edit="editProcess"
                    @delete="deleteProcess"
                />
            </div>
        </v-card>

        <draggable v-if="enableEdit"
            class="dragArea list-group" 
            :list="value.sub_proc_list" 
            :animation="200" 
            ghost-class="ghost-card"
            group="subProcess"
        >
            <transition-group>
                <div v-for="item in value.sub_proc_list"
                    :key="item.id"
                    class="cursor-pointer"
                >
                    <SubProcess 
                        :value="item" 
                        :parent="value" 
                        :storage="storage"
                        :userInfo="userInfo"
                        :enableEdit="enableEdit"
                        @view="viewProcess"
                    />
                </div>
            </transition-group>
        </draggable>
        <div v-else>
            <div v-for="item in value.sub_proc_list"
                :key="item.id"
            >
                <SubProcess 
                    :value="item" 
                    :parent="value" 
                    :storage="storage"
                    :enableEdit="enableEdit"
                    @view="viewProcess"
                />
            </div>
        </div>
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
        value: Object,
        parent: Object,
        storage: Object,
        userInfo: Object,
        enableEdit: Boolean,
    },
    data: () => ({
        type: 'major',
    }),
    methods: {
        addProcess(newProcess) {
            var newSubProc = {
                id: newProcess.id,
                label: newProcess.name ? newProcess.name : newProcess.label,
            };
            this.value.sub_proc_list.push(newSubProc);
        },
        editProcess(process) {
            this.value.id = process.id;
            this.value.label = process.label;
        },
        deleteProcess() {
            this.parent.major_proc_list = this.parent.major_proc_list.filter(item => item.id != this.value.id);
        },
        viewProcess(process) {
            this.$emit('view', process);
        }
    },
}
</script>
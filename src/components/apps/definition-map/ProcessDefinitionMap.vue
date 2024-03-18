<template>
    <div>
        <v-card elevation="10" style="height:calc(100vh - 155px); overflow: auto;">
            <div class="pt-5 pl-6 pr-6 d-flex align-center">
                <h5 class="text-h5 font-weight-semibold">{{ $t('processDefinitionMap.title') }}</h5>
                <div class="ml-auto">
                    <ProcessMenu :size="24" :type="type" @add="addProcess" />
                </div>
            </div>
            <div class="pa-5">
                <draggable v-if="enableEdit"
                    class="v-row dragArea list-group" 
                    :list="value.mega_proc_list" 
                    :animation="200" 
                    ghost-class="ghost-card"
                    group="megaProcess"
                >
                    <transition-group>
                        <v-col v-for="item in value.mega_proc_list"
                            :key="item.id" 
                            class="cursor-pointer"
                            cols="12" md="2" sm="6"
                        >
                            <MegaProcess 
                                :value="item" 
                                :parent="value" 
                                :storage="storage" 
                                @view="goProcess"
                            />
                        </v-col>
                    </transition-group>
                </draggable>
                <v-row v-else>
                    <v-col v-for="item in value.mega_proc_list" :key="item.id" cols="12" md="2" sm="6">
                        <MegaProcess :value="item" :parent="value" :storage="storage" @view="goProcess" />
                    </v-col>
                </v-row>
            </div>
        </v-card>
    </div>
</template>

<script>
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import MegaProcess from './MegaProcess.vue';
import ProcessMenu from './ProcessMenu.vue';
import ProcessDefinition from '@/components/ProcessDefinition.vue';

const storageKey = 'configuration'

export default {
    components: {
        ProcessMenu,
        MegaProcess,
        ProcessDefinition
    },
    data: () => ({
        storage: null,
        value: {
            mega_proc_list: []
        },
        type: 'map',
        enableEdit: false,
    }),
    watch: {
        //TODO: 변경 후 즉시 저장하면 안됩니다. 검토 완료 후 저장되어야 해서 저장 버튼으로 대체
        value: {
            deep: true,
            handler(newVal) {
                if (newVal) {
                    this.saveProcess()
                }
            }
        }
    },
    created() {
        this.storage = StorageBaseFactory.getStorage();
        this.getProcessMap();

        const isAdmin = localStorage.getItem("isAdmin");
        if (isAdmin == "true") {
            this.enableEdit = true;
        } else {
            this.enableEdit = false;
        }
    },
    methods: {
        async getProcessMap() {
            const procMap = await this.storage.getObject(storageKey + '/proc_map', { key: 'key' });
            if (procMap && procMap.value) {
                this.value = procMap.value;
            }
        },
        addProcess(newProcess) {
            var newMegaProc = {
                id: newProcess.id,
                label: newProcess.label,
                major_proc_list: [],
            };
            this.value.mega_proc_list.push(newMegaProc);
        },
        async saveProcess() {
            const putObj = {
                key: 'proc_map',
                value: this.value
            }
            await this.storage.putObject(storageKey, putObj);
        },
        async goProcess(obj) {
            this.$router.push(`/definition-map/sub/${obj.id}`);
        },
    },
}
</script>
<template>
    <v-card elevation="10">
        <div class="pt-5 pl-6 pr-6 d-flex align-center">
            <h5 class="text-h5 font-weight-semibold">{{ $t('processDefinitionMap.title') }}</h5>
            <div class="ml-auto">
                <ProcessMenu 
                    :size="24" 
                    :type="'map'" 
                    @add="addProcess"
                />
            </div>
        </div>
        <div class="pa-5">
            <v-row>
                <v-col v-for="item in value.mega_proc_list" 
                    :key="item.id"
                    cols="12" 
                    md="2" 
                    sm="6" 
                >
                    <MegoProcess 
                        :value="item" 
                        :parent="value" 
                        :storage="storage"
                    />
                </v-col>
            </v-row>
        </div>
    </v-card>
</template>

<script>
import StorageBase from '@/utils/StorageBase';

import ProcessMenu from './ProcessMenu.vue';
import MegoProcess from './MegoProcess.vue';

export default {
    components: {
        ProcessMenu,
        MegoProcess,
    },
    data: () => ({
        storage: null,
        value: {
            mega_proc_list: []
        },
    }),
    watch: {
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
        this.storage = StorageBase.getStorage("supabase");
    },
    mounted() {
        this.getProcessMap();
        this.storage.watch(`configuration`, this.getProcessMap);
    },
    methods:{
        async getProcessMap() {
            const procMap = await this.storage.getObject(`configuration/proc_map`, {key: 'key'});
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
                id: 1,
                configuration: this.value
            }
            await this.storage.putObject(`proc_map`, putObj);
        }
    },
}
</script>
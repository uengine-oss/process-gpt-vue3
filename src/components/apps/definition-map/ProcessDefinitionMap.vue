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

import StorageBaseFactory from '@/utils/StorageBaseFactory';
import MegoProcess from './MegoProcess.vue';
import ProcessMenu from './ProcessMenu.vue';


const storageKey = 'configuration'


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
    },
    mounted() {
        this.getProcessMap();

        //TODO 이건 실시간 반영될 필요 업습니다.
        //this.storage.watch(storageKey, this.getProcessMap);
    },
    methods:{
        async getProcessMap() {
            const procMap = await this.storage.getObject(storageKey + '/proc_map', {key: 'key'});
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
        }
    },
}
</script>
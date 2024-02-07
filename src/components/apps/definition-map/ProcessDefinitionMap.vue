<template>
    <v-card elevation="10">
        <div class="pt-5 pl-6 pr-6 d-flex align-center">
            <h5 class="text-h5 font-weight-semibold">프로세스 정의 체계도</h5>
            <div class="ml-auto">
                <ProcessMenu :size="24" :type="'Mega'" @add="addMegaProcess" />
            </div>
        </div>
        <div class="pa-5">
            <v-row>
                <v-col v-for="megaProcess in processes" 
                    :key="megaProcess.name"
                    cols="12" 
                    md="2" 
                    sm="6" 
                >
                    <MegoProcess :megaProcess="megaProcess" @updateProcess="updateProcessMap" />
                </v-col>
            </v-row>
        </div>
    </v-card>
</template>

<script>
import ProcessMenu from './ProcessMenu.vue';
import MegoProcess from './MegoProcess.vue';

export default {
    components: {
        ProcessMenu,
        MegoProcess,
    },
    data: () => ({
        storage: null,
        processes: [],
    }),
    watch: {
        processes: {
            deep: true,
            handler(newVal) {
                if (newVal) {
                    this.updateProcessMap();
                }
            }
        }
    },
    created() {
        this.init();
    },
    methods:{
        async init() {
            await this.storage.watch(`definitions`, (callback) => {
                this.processes = [];
                if (callback) {
                    if (callback.megaProcess) {
                        this.processes = callback.megaProcess;
                    } else {
                        this.processes = [];
                    }
                }
            });
        },
        addMegaProcess(newProcess) {
            this.processes[newProcess.id] = newProcess;

            this.updateProcessMap();
        },
        async updateProcessMap() {
            var putObj = {
                megaProcess: this.processes
            };
            await this.storage.putObject(`definitions`, putObj);
        }
    },
}
</script>
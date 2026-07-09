<template>
    <v-container fluid class="pa-6">
        <div class="d-flex align-center mb-4">
            <v-icon size="28" color="primary" class="mr-3">mdi-chart-box-outline</v-icon>
            <div>
                <h2 class="text-h5">요청 자동분류 · Top List</h2>
                <div class="text-body-2 text-medium-emphasis">
                    프로세스 인스턴스의 요청 내용을 자동 분류하고, 유사 사례의 처리결과를 제공합니다.
                </div>
            </div>
        </div>

        <v-row>
            <v-col cols="12" md="7">
                <v-card variant="outlined" rounded="lg">
                    <InstanceTopList />
                </v-card>
            </v-col>
            <v-col cols="12" md="5">
                <v-card variant="outlined" rounded="lg" class="pa-2">
                    <div class="text-subtitle-1 px-2 pt-2">워크아이템 핸들러 · 유사 사례 패널</div>
                    <div class="text-caption text-medium-emphasis px-2 pb-1">
                        예시 인스턴스: <code>{{ demoInstId }}</code>
                    </div>
                    <SimilarInstancesPanel v-if="demoInstId" :procInstId="demoInstId" />
                </v-card>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
import InstanceTopList from '@/components/apps/instance-classifier/InstanceTopList.vue';
import SimilarInstancesPanel from '@/components/apps/instance-classifier/SimilarInstancesPanel.vue';
import InstanceClassifierAPI from '@/utils/instanceClassifier';

export default {
    name: 'InstanceClassifierDemo',
    components: { InstanceTopList, SimilarInstancesPanel },
    data() {
        return { demoInstId: null };
    },
    async mounted() {
        // 데모용: 분류된 인스턴스 중 하나를 골라 유사 사례 패널에 태운다.
        try {
            const defs = await InstanceClassifierAPI.procDefs();
            const def = defs.find((d) => d.count > 1) || defs[0];
            if (def) {
                const tl = await InstanceClassifierAPI.topList(def.proc_def_id);
                const real = (tl.items || []).find((t) => !t.is_noise);
                if (real) {
                    const ins = await InstanceClassifierAPI.topicInstances(def.proc_def_id, real.topic_id, 1);
                    if (ins.length) this.demoInstId = ins[0].proc_inst_id;
                }
            }
        } catch (e) {
            console.error('[demo] 초기화 실패', e);
        }
    }
};
</script>

<template>
    <div class="pa-3">
        <div class="d-flex align-center mb-2">
            <v-icon size="small" class="mr-2">mdi-set-merge</v-icon>
            <span class="text-subtitle-2">유사 과거 사례</span>
            <v-spacer />
            <v-btn size="x-small" variant="text" icon="mdi-refresh" @click="load" :loading="loading" />
        </div>
        <p class="text-caption text-medium-emphasis mb-3">
            이 인스턴스의 요청과 비슷한 과거 인스턴스입니다. 각 사례를 펼치면 단계별 산출물(입력된 폼)을 열어볼 수 있습니다.
        </p>

        <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-2" />

        <v-alert v-if="!loading && !neighbors.length" type="info" variant="tonal" density="compact">
            유사한 과거 사례가 아직 없습니다.
        </v-alert>

        <v-expansion-panels v-else variant="accordion" multiple>
            <v-expansion-panel v-for="n in neighbors" :key="n.proc_inst_id">
                <v-expansion-panel-title>
                    <div class="d-flex align-center w-100" style="gap: 8px">
                        <v-chip size="x-small" :color="simColor(n.similarity)" label>
                            {{ n.similarity != null ? (n.similarity * 100).toFixed(0) + '%' : '-' }}
                        </v-chip>
                        <span class="text-truncate">{{ n.proc_inst_name || n.proc_inst_id }}</span>
                        <v-chip v-if="n.topic_name" size="x-small" variant="tonal">{{ n.topic_name }}</v-chip>
                    </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                    <div class="text-caption text-medium-emphasis mb-1">요청 내용</div>
                    <div class="text-body-2 mb-3" style="white-space: pre-wrap">{{ n.request_text }}</div>

                    <div class="text-caption text-medium-emphasis mb-1">산출물 (단계별 입력 폼)</div>
                    <!-- 기존 산출물 뷰 재사용: 인스턴스의 완료 단계별 폼을 읽기전용으로 렌더 -->
                    <InstanceOutput
                        :instance="{ defId: procDefId || defIdOf(n), instId: n.proc_inst_id }"
                        :isInWorkItem="true"
                    />
                </v-expansion-panel-text>
            </v-expansion-panel>
        </v-expansion-panels>
    </div>
</template>

<script>
import InstanceClassifierAPI from '@/utils/instanceClassifier';
import InstanceOutput from '@/components/apps/todolist/InstanceOutput.vue';

export default {
    name: 'SimilarInstancesPanel',
    components: { InstanceOutput },
    props: {
        procInstId: { type: String, required: true }
    },
    data() {
        return { neighbors: [], loading: false, loadedFor: null, procDefId: null };
    },
    watch: {
        procInstId: {
            immediate: true,
            handler(v) {
                if (v && v !== this.loadedFor) this.load();
            }
        }
    },
    methods: {
        async load() {
            if (!this.procInstId) return;
            this.loading = true;
            this.loadedFor = this.procInstId;
            try {
                // 산출물은 InstanceOutput 이 인스턴스별로 직접 조회하므로 with_outputs 불필요.
                const data = await InstanceClassifierAPI.similar({
                    proc_inst_id: this.procInstId,
                    with_outputs: false
                });
                this.neighbors = data.neighbors || [];
                this.procDefId = data.proc_def_id || null;
            } catch (e) {
                console.error('[SimilarInstancesPanel] 유사 인스턴스 로드 실패', e);
                this.neighbors = [];
            } finally {
                this.loading = false;
            }
        },
        defIdOf(n) {
            const id = n && n.proc_inst_id;
            return id && id.includes('.') ? id.split('.')[0] : id;
        },
        simColor(s) {
            if (s == null) return 'grey';
            if (s >= 0.85) return 'success';
            if (s >= 0.7) return 'primary';
            return 'grey';
        }
    }
};
</script>

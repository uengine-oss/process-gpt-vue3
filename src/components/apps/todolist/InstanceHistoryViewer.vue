<template>
    <v-card class="instance-history-viewer" elevation="10">
        <div class="instance-history-viewer__body">
            <InstanceProgress
                v-if="resolvedInstance"
                :key="`progress-${resolvedInstance?.instId || resolvedInstance?.instanceId}`"
                :instance="resolvedInstance"
                ref="progress"
                class="instance-history-viewer__content"
            />
            <v-alert v-else type="info" variant="tonal" density="compact" class="ma-4">
                인스턴스 정보가 없습니다.
            </v-alert>
        </div>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import InstanceProgress from './InstanceProgress.vue';

const backend = BackendFactory.createBackend();

export default {
    name: 'InstanceHistoryViewer',
    components: {
        InstanceProgress,
    },
    props: {
        // 외부에서 InstanceCard처럼 instance를 직접 전달하는 경우
        instance: {
            type: Object,
            required: false,
            default: null,
        },
    },
    data: () => ({
        loadedInstance: null,
        isLoading: false,
    }),
    computed: {
        routeInstId() {
            const raw = this.$route?.params?.instId;
            if (!raw) return null;
            return String(raw).replace(/_DOT_/g, '.');
        },
        resolvedInstance() {
            return this.instance || this.loadedInstance;
        },
    },
    watch: {
        instance: {
            deep: true,
            immediate: true,
            async handler(newVal) {
                // prop으로 instance가 오면 별도 로드 불필요
                if (newVal) return;
                await this.loadInstanceByRoute();
            },
        },
        '$route': {
            deep: true,
            async handler(newVal, oldVal) {
                if (newVal?.params?.instId !== oldVal?.params?.instId) {
                    await this.loadInstanceByRoute();
                }
            },
        },
    },
    async mounted() {
        await this.loadInstanceByRoute();
    },
    methods: {
        async loadInstanceByRoute() {
            const instId = this.routeInstId;
            if (!instId) return;
            // prop이 있으면 우선 사용
            if (this.instance) return;

            const me = this;
            me.isLoading = true;
            me.$try({
                context: me,
                action: async () => {
                    me.loadedInstance = await backend.getInstance(instId);
                },
                finalAction: () => {
                    me.isLoading = false;
                },
            });
        },
    },
};
</script>

<style scoped>
.instance-history-viewer {
    height: 100%;
    width: 100%;
    overflow: hidden;
}

.instance-history-viewer__body {
    height: 100%;
    width: 100%;
    overflow: hidden;
}

.instance-history-viewer__content {
    height: 100%;
    width: 100%;
}
</style>
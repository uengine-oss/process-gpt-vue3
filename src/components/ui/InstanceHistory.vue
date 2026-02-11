<template>
    <v-card class="instance-history" elevation="10">
        <slot name="header"> 
            <v-row class="ma-0 pa-4 pb-2 align-center">
                <v-card-title class="pa-0">
                    인스턴스 업무 히스토리
                </v-card-title>
                <v-spacer></v-spacer>
                <v-btn
                    variant="text"
                    density="compact"
                    :loading="loading"
                    :disabled="!resolvedInstId"
                    @click="load"
                >
                    <v-icon class="mr-1">mdi-refresh</v-icon>
                    새로고침
                </v-btn>
            </v-row>
        
            <v-divider></v-divider>
        </slot>
        

        <slot name="body">
            <div class="instance-history__body">
                <v-alert
                    v-if="!resolvedInstId"
                    type="info"
                    variant="tonal"
                    density="compact"
                    class="ma-4"
                >
                    인스턴스 ID가 없습니다.
                </v-alert>

                <template v-else>
                    <div class="instance-history__header pa-4 pb-2">
                        <div class="d-flex align-center flex-wrap ga-2">
                            <div class="text-subtitle-1 font-weight-semibold">
                                ID: {{ resolvedInstId }}
                            </div>
                            <v-chip v-if="resolvedInstance?.status" size="x-small" variant="outlined">
                                {{ resolvedInstance.status }}
                            </v-chip>
                            <v-chip v-if="taskCount != null" size="x-small" variant="outlined">
                                태스크 {{ taskCount }}개
                            </v-chip>
                        </div>

                        <v-text-field
                            v-model="search"
                            class="mt-3"
                            variant="outlined"
                            density="compact"
                            hide-details
                            clearable
                            label="검색 (태스크명/담당자/상태)"
                        ></v-text-field>
                    </div>

                    <v-divider></v-divider>

                    <v-row class="ma-0 pa-0 instance-history__content">
                        <!-- 좌측: 태스크 목록 -->
                        <v-col
                            cols="12"
                            :md="selectedTask ? 7 : 12"
                            class="pa-0 instance-history__left"
                        >
                            <v-data-table
                                :items="filteredTasks"
                                :headers="headers"
                                :loading="loading"
                                item-key="taskId"
                                :items-per-page="-1"
                                hide-default-footer
                                density="compact"
                                class="instance-history__table"
                                fixed-header
                                height="100%"
                                @click:row="onRowClick"
                            >
                                <template #item.taskId="{ item }">
                                    <span style="font-variant-numeric: tabular-nums;">
                                        {{ item.taskId ?? '-' }}
                                    </span>
                                </template>

                                <template #item.title="{ item }">
                                    <span class="text-truncate" style="display: inline-block; max-width: 100%;">
                                        {{ item.title || '(이름 없음)' }}
                                    </span>
                                </template>

                                <template #item.status="{ item }">
                                    <v-chip size="x-small" variant="outlined">
                                        {{ item.status || '-' }}
                                    </v-chip>
                                </template>

                                <template #item.claimed="{ item }">
                                    <v-chip
                                        v-if="item.claimedEligible === true"
                                        size="x-small"
                                        :color="item.claimed ? 'primary' : 'default'"
                                        variant="outlined"
                                    >
                                        {{ item.claimed ? '선점' : '-' }}
                                    </v-chip>
                                    <span v-else>-</span>
                                </template>

                                <template #item.delegated="{ item }">
                                    <v-chip
                                        size="x-small"
                                        :color="item.delegated ? 'warning' : 'default'"
                                        variant="outlined"
                                    >
                                        {{ item.delegated ? '위임' : '-' }}
                                    </v-chip>
                                </template>

                                <template #item.assignee="{ item }">
                                    <span class="text-truncate" style="display: inline-block; max-width: 160px;">
                                        {{ item.assignee || '-' }}
                                    </span>
                                </template>

                                <template #item.startDate="{ item }">
                                    <span class="text-caption">{{ formatDate(item.startDate) }}</span>
                                </template>

                                <template #item.endDate="{ item }">
                                    <span class="text-caption">{{ formatDate(item.endDate) }}</span>
                                </template>

                                <template v-if="$slots.actions" #item.actions="{ item }">
                                    <slot name="actions" :item="item" />
                                </template>
                            </v-data-table>
                        </v-col>

                        <!-- 우측: 히스토리/상세(읽기 전용) -->
                        <v-col
                            v-if="selectedTask"
                            cols="12"
                            md="5"
                            class="pa-0 instance-history__right"
                        >
                            <div class="pa-4">
                                <div class="d-flex align-center">
                                    <div class="text-subtitle-1 font-weight-semibold">
                                        선택 태스크
                                    </div>
                                    <v-spacer></v-spacer>
                                    <v-chip size="x-small" variant="outlined">
                                        {{ selectedTask.status || '-' }}
                                    </v-chip>
                                    <v-tooltip location="bottom">
                                        <template #activator="{ props }">
                                            <v-btn
                                                v-bind="props"
                                                icon
                                                variant="text"
                                                density="compact"
                                                class="ml-1"
                                                @click="closeSelectedTask"
                                            >
                                                <v-icon>mdi-close</v-icon>
                                            </v-btn>
                                        </template>
                                        닫기
                                    </v-tooltip>
                                </div>
                                <div class="mt-3">
                                    <div class="text-subtitle-2 font-weight-medium">
                                        {{ selectedTask.title || '(이름 없음)' }}
                                    </div>
                                    <div class="text-caption text-grey-darken-1 mt-1">
                                        TaskId: {{ selectedTask.taskId }} |
                                        담당자: {{ selectedTask.assignee || '-' }} |
                                        위임: {{ selectedTask.delegated ? 'Y' : 'N' }} |
                                        선점: {{ selectedTask.claimedEligible ? (selectedTask.claimed ? 'Y' : 'N') : '-' }}
                                    </div>

                                    <v-divider class="my-3"></v-divider>

                                    <v-list density="compact" class="instance-history__timeline">
                                        <v-list-item>
                                            <v-list-item-title>시작일</v-list-item-title>
                                            <v-list-item-subtitle>{{ formatDateTime(selectedTask.startDate) }}</v-list-item-subtitle>
                                        </v-list-item>
                                        <v-list-item>
                                            <v-list-item-title>종료일</v-list-item-title>
                                            <v-list-item-subtitle>{{ formatDateTime(selectedTask.endDate) }}</v-list-item-subtitle>
                                        </v-list-item>
                                        <v-list-item>
                                            <v-list-item-title>Due</v-list-item-title>
                                            <v-list-item-subtitle>{{ formatDateTime(selectedTask.dueDate) }}</v-list-item-subtitle>
                                        </v-list-item>
                                    </v-list>

                                    <v-expansion-panels class="mt-3" variant="accordion">
                                        <v-expansion-panel>
                                            <v-expansion-panel-title>원본 데이터(읽기 전용)</v-expansion-panel-title>
                                            <v-expansion-panel-text>
                                                <pre class="instance-history__json">{{ stringify(selectedTask.raw) }}</pre>
                                            </v-expansion-panel-text>
                                        </v-expansion-panel>
                                    </v-expansion-panels>

                                    <v-alert type="warning" variant="tonal" density="compact" class="mt-3">
                                        이 화면에서는 **수정/선점/위임 작업을 할 수 없습니다**. (조회 전용)
                                    </v-alert>
                                </div>
                            </div>
                        </v-col>
                    </v-row>
                </template>
            </div>
        </slot>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    name: 'InstanceHistory',
    props: {
        // 외부에서 인스턴스 객체를 넘기는 경우
        instance: {
            type: Object,
            required: false,
            default: null,
        },
        // 외부에서 instId만 넘기는 경우
        instId: {
            type: [String, Number],
            required: false,
            default: null,
        },
    },
    data: () => ({
        loading: false,
        resolvedInstance: null,
        tasks: [],
        selectedTask: null,
        search: '',
        baseHeaders: [
            { title: '태스크ID', key: 'taskId', sortable: true, width: 90 },
            { title: '태스크명', key: 'title', sortable: true },
            { title: '상태', key: 'status', sortable: true, width: 110 },
            { title: '선점', key: 'claimed', sortable: true, width: 80 },
            { title: '위임', key: 'delegated', sortable: true, width: 80 },
            { title: '담당자', key: 'assignee', sortable: true, width: 140 },
            { title: '시작', key: 'startDate', sortable: true, width: 120 },
            { title: '종료', key: 'endDate', sortable: true, width: 120 },
        ],
    }),
    computed: {
        headers() {
            const list = [...this.baseHeaders];
            if (this.$slots.actions) {
                list.push({ title: '기능', key: 'actions', sortable: false, width: 100 });
            }
            return list;
        },
        mode() {
            return window.$mode;
        },
        resolvedInstId() {
            const fromProp = this.instId || this.instance?.instId || this.instance?.instanceId || null;
            if (fromProp) return fromProp;
            const raw = this.$route?.params?.instId;
            if (!raw) return null;
            return String(raw).replace(/_DOT_/g, '.');
        },
        taskCount() {
            return Array.isArray(this.tasks) ? this.tasks.length : 0;
        },
        filteredTasks() {
            const q = String(this.search || '').trim().toLowerCase();
            if (!q) return this.tasks;
            return (this.tasks || []).filter((t) => {
                return (
                    String(t.taskId ?? '').toLowerCase().includes(q) ||
                    String(t.title ?? '').toLowerCase().includes(q) ||
                    String(t.status ?? '').toLowerCase().includes(q) ||
                    String(t.assignee ?? '').toLowerCase().includes(q)
                );
            });
        },
    },
    watch: {
        instance: {
            deep: true,
            immediate: true,
            async handler(newVal) {
                if (newVal) {
                    this.resolvedInstance = newVal;
                }
                await this.load();
            },
        },
        '$route': {
            deep: true,
            async handler(newVal, oldVal) {
                if (newVal?.params?.instId !== oldVal?.params?.instId) {
                    await this.load();
                }
            },
        },
    },
    async mounted() {
        await this.load();
    },
    methods: {
        stringify(obj) {
            try {
                return JSON.stringify(obj, null, 2);
            } catch (e) {
                return String(obj);
            }
        },
        formatDate(value) {
            if (!value) return '-';
            const d = new Date(value);
            if (Number.isNaN(d.getTime())) return String(value);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}.${m}.${day}`;
        },
        formatDateTime(value) {
            if (!value) return '-';
            const d = new Date(value);
            if (Number.isNaN(d.getTime())) return String(value);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            return `${y}.${m}.${day} ${hh}:${mm}`;
        },
        normalizeTask(item) {
            // 다양한 모드/백엔드의 worklist를 통일된 형태로 변환
            const taskId = item?.taskId ?? item?.id ?? item?.task?.taskId ?? null;
            const status = item?.status ?? item?.task?.status ?? null;
            const title =
                item?.title ||
                item?.name ||
                item?.task?.title ||
                item?.task?.activity_name ||
                item?.task?.name ||
                '';
            // uEngine worklist에는 endpoint(아이디)와 resName(표시명)이 같이 내려올 수 있음
            const endpoint =
                item?.username ||
                item?.endpoint ||
                item?.task?.username ||
                item?.task?.endpoint ||
                null;
            const resName =
                item?.resName ||
                item?.res_name ||
                item?.task?.resName ||
                item?.task?.res_name ||
                null;
            // 화면에는 resName을 우선 표시 (없으면 endpoint fallback)
            const assignee = resName || endpoint || null;

            // 선점 표시는 dispatchOption=1 인 경우에만 허용
            const dispatchOptionRaw =
                item?.dispatchOption ??
                item?.dispatchingOption ??
                item?.task?.dispatchOption ??
                item?.task?.dispatchingOption ??
                item?.dispatch_option ??
                item?.task?.dispatch_option ??
                null;
            const dispatchOption = dispatchOptionRaw == null ? null : Number(dispatchOptionRaw);
            const claimedEligible = dispatchOption === 1;
            // 선점(assigned/endpoint 존재로 간주) - 단, eligible일 때만
            const claimed = claimedEligible ? !!endpoint : false;

            // 위임 정보는 백엔드마다 다르므로 최대한 넓게 추론
            const delegated =
                !!item?.delegated ||
                !!item?.task?.delegated ||
                !!item?.task?.delegatedRoleMapping ||
                !!item?.task?.delegatee ||
                !!item?.task?.delegated_to;

            return {
                taskId,
                title,
                status,
                claimed,
                claimedEligible,
                delegated,
                assignee,
                startDate: item?.startDate ?? item?.start_date ?? item?.task?.startDate ?? null,
                endDate: item?.endDate ?? item?.end_date ?? item?.task?.endDate ?? null,
                dueDate: item?.dueDate ?? item?.due_date ?? item?.task?.dueDate ?? null,
                raw: item,
            };
        },
        async load() {
            const me = this;
            me.$try({
                context: me,
                action: async () => {
                    const instId = this.resolvedInstId;
                    if (!instId) return;

                    me.loading = false;
                    // instance prop이 없으면 instance도 로드(요약 정보 표시용)
                    if (!me.instance) {
                        me.resolvedInstance = await backend.getInstance(String(instId));
                    }

                    // 인스턴스 전체 태스크 조회 (DONE/COMPLETED 포함)
                    const idNum = typeof instId === 'number' ? instId : parseInt(String(instId), 10);
                    const list = await backend.getAllWorkListByInstId(Number.isNaN(idNum) ? instId : idNum);
                    const tasks = Array.isArray(list) ? list.map(me.normalizeTask).filter((t) => t.taskId != null) : [];

                    // 최근 순 정렬(종료일 → 시작일 → taskId)
                    tasks.sort((a, b) => {
                        const ad = a.endDate || a.startDate || 0;
                        const bd = b.endDate || b.startDate || 0;
                        const at = new Date(ad).getTime();
                        const bt = new Date(bd).getTime();
                        if (!Number.isNaN(bt) && !Number.isNaN(at) && bt !== at) return bt - at;
                        return Number(b.taskId) - Number(a.taskId);
                    });

                    me.tasks = tasks;
                    // 선택 유지: 같은 taskId가 있으면 유지
                    if (me.selectedTask?.taskId != null) {
                        const still = tasks.find((t) => String(t.taskId) === String(me.selectedTask.taskId));
                        me.selectedTask = still || null;
                    }
                },
                finalAction: () => {
                    me.loading = false;
                },
            });
        },
        onRowClick(event, row) {
            // Vuetify v-data-table row click signature 차이 대응
            const item = row?.item || row;
            if (!item) return;
            this.selectedTask = item;
        },
        closeSelectedTask() {
            this.selectedTask = null;
        },
    },
};
</script>

<style scoped>
.instance-history {
    height: 100%;
    width: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.instance-history__body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
}

.instance-history__content {
    height: 100%;
    min-height: 0;
}

.instance-history__left,
.instance-history__right {
    height: 100%;
    min-height: 0;
    overflow: hidden;
}

.instance-history__table {
    height: 100%;
}

.instance-history__json {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    user-select: text;
    font-size: 12px;
    line-height: 1.4;
}
</style>
<template>
    <div class="w-100 instance-card-tab-height">
        <v-row v-if="outputList.length > 0" class="ma-0 pa-0">
            <v-col
                v-for="(item, index) in outputList"
                :key="index"
                cols="12"
                :lg="isInWorkItem || compact ? 12 : 6"
                :md="isInWorkItem || compact ? 12 : 6"
                sm="12"
                :class="compact ? 'pa-1' : 'pa-2'"
            >
                <!--
                    좁은 칸(간소화 화면의 산출물)에서는 폼 원본을 그리지 않는다.
                    폼은 제 폭을 갖고 만들어진 것이라 200px 남짓한 칸에 넣으면
                    글자가 세로로 쪼개져 읽을 수 없다. 여기서는 값만 줄로 펴
                    보여 주고, 원본은 눌러서 크게 연다.
                -->
                <!--
                    산출물이 하나뿐이면 접을 이유가 없다 — 칸 전체가 비어 있는데
                    '자세히 보기'를 한 번 더 누르게 할 까닭이 없다.
                    둘 이상일 때만 줄여서 쌓고, 누르면 펼친다.
                -->
                <OutputCard v-if="compact" :item="item" :full="isSolo" />

                <v-card v-else elevation="2" class="pa-4">
                    <v-card-title class="pa-0 pb-4">{{ item.name }}</v-card-title>
                    <!-- output URL -->
                    <v-tooltip v-if="item.outputURL" location="bottom">
                        <template v-slot:activator="{ props }">
                            <v-icon class="ml-1" v-bind="props" size="16" @click="openOutputURL(item.outputURL)"> mdi-link-variant </v-icon>
                        </template>
                        {{ item.outputURL }}
                    </v-tooltip>
                    <v-row class="ma-0 pa-0 justify-end">
                        <SummaryButton v-if="item.type === 'form'">
                            <DynamicForm :formHTML="item.html" v-model="item.output" :readonly="true" class="dynamic-form" />
                        </SummaryButton>
                        <SummaryButton v-else-if="item.type === 'html'">
                            <div v-html="item.html" class="border border-1 border-gray-300 rounded-md pa-2"></div>
                        </SummaryButton>
                    </v-row>
                </v-card>
            </v-col>
        </v-row>

    </div>
</template>

<script>
import DynamicForm from '@/components/designer/DynamicForm.vue';
import SummaryButton from '@/components/ui/SummaryButton.vue';
import OutputCard from './OutputCard.vue';

import BackendFactory from '@/components/api/BackendFactory';
import { fetchFormDefs, formIdOf, hasValue, stripScopeSuffix } from '@/shared/workItemOutput';
const backend = BackendFactory.createBackend();

export default {
    components: {
        DynamicForm,
        SummaryButton,
        OutputCard
    },
    props: {
        instance: Object,
        isInWorkItem: {
            type: Boolean,
            default: false
        },
        /** 좁은 칸에 넣을 때. 폼 원본 대신 값 요약으로 보여 준다. */
        compact: {
            type: Boolean,
            default: false
        }
    },
    data: () => ({
        outputList: [],
        workWatchRef: null,
        rootWatchRef: null
    }),
    mounted() {
        this.init();
        this.watchWork();
    },
    unmounted() {
        [this.workWatchRef, this.rootWatchRef].forEach((ref) => {
            if (ref) backend.watchOff(ref);
        });
        this.workWatchRef = null;
        this.rootWatchRef = null;
    },
    computed: {
        /** 산출물이 하나뿐인가. 하나면 줄이지 않고 그대로 보여 준다. */
        isSolo() {
            return this.compact && this.outputList.length === 1;
        },
        id() {
            if (this.$route.params.instId) {
                return this.$route.params.instId.replace(/_DOT_/g, '.');
            } else {
                return null;
            }
        }
    },
    watch: {
        $route: {
            deep: true,
            handler(newVal, oldVal) {
                if (newVal.params.instId && newVal.params.instId !== oldVal.params.instId) {
                    this.outputList = [];
                    this.init();
                }
            }
        }
    },
    methods: {
        /**
         * 업무가 끝날 때마다 다시 읽는다.
         *
         * 전에는 화면에 들어올 때 한 번만 읽었다. 남이 옆에서 한 단계를 끝내도
         * 산출물 칸은 그대로라, 새로고침해야 새 산출물이 나타났다.
         */
        async watchWork() {
            if (!this.instance || !this.instance.instId) return;
            const reload = () => this.init();
            this.workWatchRef = await backend.watchWorkList(reload, { instId: this.instance.instId });
            this.rootWatchRef = await backend.watchWorkList(reload, { rootInstId: this.instance.instId });
        },

        async init() {
            this.outputList = [];

            const taskList = await backend.getAllWorkListByInstId(this.instance.instId);
            // 서브 프로세스 단계의 폼은 서브 프로세스 정의에 딸려 있다 — 업무들이 가리키는 정의마다 받는다.
            const formList = await fetchFormDefs(backend, {
                defIds: [this.instance.defId, ...taskList.map((t) => t.defId)],
                formIds: taskList.map(formIdOf)
            });
            const sortedTaskList = taskList.sort((a, b) => new Date(b.endDate) - new Date(a.endDate));

            const outputList = [];
            sortedTaskList.forEach(async (item) => {
                if (item.status !== 'DONE') return;
                const name = stripScopeSuffix(item.name);
                // 좁은 칸(대화 옆 산출물 판)에는 값이 없는 단계를 올리지 않는다 — 대화의 카드와 같은 규칙.
                if (this.compact && item.task.agent_mode !== 'A2A' && !hasValue(item.task.output)) return;
                if (item.task.agent_mode === 'A2A') {
                    outputList.push({
                        id: item.id,
                        type: 'html',
                        name,
                        html: item.task.output['html'],
                        output: item.task.output['table_data'],
                        outputURL: item.task.output_url || null
                    });
                }
                const formId = (item.tool || '').replace('formHandler:', '');
                const form = formList.find((form) => form.id === formId);
                if (!form) {
                    // 폼으로 만들어지지 않은 산출물(에이전트가 내놓은 값 등)도 남긴다.
                    // 이걸 빼 두면 사람이 채운 폼 하나만 보이고, 정작 에이전트가
                    // 만든 결과는 어디에도 나오지 않는다.
                    if (item.task.output && Object.keys(item.task.output).length > 0) {
                        outputList.push({
                            id: item.taskId,
                            type: 'value',
                            name,
                            html: null,
                            output: item.task.output,
                            outputURL: item.task.output_url || null
                        });
                    }
                    return;
                }
                if (form) {
                    if (item.task.output && item.task.output[formId]) {
                        outputList.push({
                            id: formId,
                            type: 'form',
                            name,
                            html: form.html,
                            output: item.task.output[formId],
                            outputURL: item.task.output_url || null
                        });
                    } else {
                        let formData = {};
                        form.fields_json.map((field) => {
                            formData[field.key] = field.type == 'text' || field.type == 'textarea' ? '' : null;
                        });
                        outputList.push({
                            id: formId,
                            type: 'form',
                            name,
                            html: form.html,
                            output: formData,
                            outputURL: item.task.output_url || null
                        });
                    }
                }
            });
            this.outputList = outputList;
        },
        openOutputURL(url) {
            window.open(url, '_blank');
        }
    }
};
</script>

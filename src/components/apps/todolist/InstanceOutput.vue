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
                <v-card
                    v-if="compact"
                    elevation="0"
                    class="pa-3 pg-out-card"
                    :class="{ 'pg-out-card--solo': isSolo }"
                    @click="isSolo ? null : openDetail(item)"
                >
                    <div class="pg-out-card__name">{{ item.name }}</div>
                    <div v-for="(l, i) in summaryLines(item)" :key="i" class="pg-out-card__line">
                        <span class="pg-out-card__k">{{ l.k }}</span>
                        <a v-if="l.href" class="pg-out-card__v pg-out-card__v--file" :href="l.href" :download="l.v" @click.stop>
                            <v-icon size="14">mdi-file-download-outline</v-icon>
                            <span>{{ l.v }}</span>
                        </a>
                        <span v-else class="pg-out-card__v" :class="{ 'pg-out-card__v--wrap': isSolo }">{{ l.v }}</span>
                    </div>
                    <div v-if="!summaryLines(item).length" class="pg-out-card__empty">내용 없음</div>
                    <div v-if="!isSolo" class="pg-out-card__more">자세히 보기</div>
                    <div v-else class="pg-out-card__more" @click.stop="openDetail(item)">원본 보기</div>
                </v-card>

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

        <v-dialog v-model="detailDialog" width="92vw" max-width="900px">
            <v-card class="pa-4">
                <v-card-title class="d-flex align-center pa-0 pb-3">
                    <span class="text-subtitle-1 font-weight-bold">{{ detailItem ? detailItem.name : '' }}</span>
                    <v-spacer></v-spacer>
                    <v-btn icon variant="text" @click="detailDialog = false"><v-icon>mdi-close</v-icon></v-btn>
                </v-card-title>
                <v-card-text class="pa-0">
                    <DynamicForm
                        v-if="detailItem && detailItem.type === 'form'"
                        :formHTML="detailItem.html"
                        v-model="detailItem.output"
                        :readonly="true"
                        class="dynamic-form"
                    />
                    <div v-else-if="detailItem && detailItem.type === 'html'" v-html="detailItem.html"></div>
                    <div v-else-if="detailItem">
                        <div v-for="(l, i) in summaryLines(detailItem)" :key="i" class="pg-out-card__line">
                            <span class="pg-out-card__k">{{ l.k }}</span>
                            <a v-if="l.href" class="pg-out-card__v pg-out-card__v--file" :href="l.href" :download="l.v">
                                <v-icon size="14">mdi-file-download-outline</v-icon>
                                <span>{{ l.v }}</span>
                            </a>
                            <span v-else class="pg-out-card__v pg-out-card__v--wrap">{{ l.v }}</span>
                        </div>
                    </div>
                </v-card-text>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import DynamicForm from '@/components/designer/DynamicForm.vue';
import SummaryButton from '@/components/ui/SummaryButton.vue';
import { fileNameOf, isWorkspacePath, workspaceFileUrl } from '@/utils/workspaceFile';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        DynamicForm,
        SummaryButton
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
        rootWatchRef: null,
        detailDialog: false,
        detailItem: null
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

            const formOptions = {
                match: {
                    proc_def_id: this.instance.defId
                }
            };
            const formList = await backend.listDefinition('form_def', formOptions);

            const taskList = await backend.getAllWorkListByInstId(this.instance.instId);
            const sortedTaskList = taskList.sort((a, b) => new Date(b.endDate) - new Date(a.endDate));

            const outputList = [];
            sortedTaskList.forEach(async (item) => {
                if (item.status !== 'DONE') return;
                if (item.task.agent_mode === 'A2A') {
                    outputList.push({
                        id: item.id,
                        type: 'html',
                        name: item.task.activity_name,
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
                            name: item.name,
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
                            name: item.name,
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
                            name: item.name,
                            html: form.html,
                            output: formData,
                            outputURL: item.task.output_url || null
                        });
                    }
                }
            });
            this.outputList = outputList;
        },
        /** 산출물 값을 읽을 수 있는 줄로 편다. 폼 아이디로 한 겹 감싸여 오기도 한다. */
        summaryLines(item) {
            const out = item && item.output;
            if (!out || typeof out !== 'object') return [];
            const lines = [];
            const walk = (obj, depth) => {
                if (depth > 2 || lines.length >= 8) return;
                Object.keys(obj).forEach((k) => {
                    if (lines.length >= 8) return;
                    const v = obj[k];
                    const file = this.fileEntry(v);
                    if (file) {
                        lines.push({ k: String(k).replace(/_/g, ' '), v: file.name, href: file.href });
                        return;
                    }
                    if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, depth + 1);
                    else if (v !== null && v !== undefined && v !== '') {
                        const raw = Array.isArray(v) ? v.join(', ') : String(v);
                        lines.push({
                            k: String(k).replace(/_/g, ' '),
                            v: this.readable(raw),
                            // 작업 공간에 남은 파일은 이름만 보여 주고 끝내는 것이 아니라,
                            // 눌러서 받을 수 있게 해 둔다.
                            href: isWorkspacePath(raw) ? workspaceFileUrl(raw) : ''
                        });
                    }
                });
            };
            walk(out, 0);
            return lines;
        },
        /**
         * 파일 하나를 가리키는 값이면 이름과 받을 주소를 돌려준다.
         * 에이전트가 올린 문서는 {path, name, html_url, ext} 꼴로 남는데,
         * 그대로 펀면 칸 하나에 긴 주소 여러 줄이 쌓인다.
         */
        fileEntry(v) {
            if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
            const path = v.path || v.fullPath || v.file_path || '';
            if (!path) return null;
            const name = v.name || fileNameOf(String(path));
            const href = isWorkspacePath(path) ? workspaceFileUrl(String(path)) : String(path);
            return { name, href: /^https?:[/][/]/.test(href) ? href : '' };
        },

        /**
         * 값을 읽기 좋게.
         * 파일은 작업 공간 경로(/workspace/…)로 오는데, 요약에서 필요한 것은
         * 어떤 파일인지이지 어디에 있는지가 아니다. 이름만 남긴다 —
         * 실제 파일은 '자세히 보기' 안의 폼에서 내려받는다.
         */
        readable(v) {
            const t = String(v);
            if (isWorkspacePath(t)) return fileNameOf(t);
            if (/^[\/].*[\/]/.test(t) && !t.includes(' ')) return t.split(/[\/]/).pop();
            return t;
        },
        openDetail(item) {
            this.detailItem = item;
            this.detailDialog = true;
        },
        openOutputURL(url) {
            window.open(url, '_blank');
        }
    }
};
</script>

<style scoped>
.pg-out-card {
    border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
    border-radius: 12px;
    cursor: pointer;
}

/* 하나뿐일 때는 눌러서 펼칠 것이 없으므로 손 모양도 쓰지 않는다. */
.pg-out-card--solo {
    cursor: default;
}

.pg-out-card:hover {
    border-color: rgb(var(--v-theme-primary));
}

.pg-out-card__name {
    font-size: 0.875rem;
    font-weight: 700;
    margin-bottom: 6px;
}

.pg-out-card__line {
    display: flex;
    gap: 8px;
    font-size: 0.75rem;
    line-height: 1.7;
}

.pg-out-card__k {
    flex: 0 0 auto;
    max-width: 34%;
    color: rgba(var(--v-theme-on-surface), 0.5);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pg-out-card__v {
    flex: 1 1 auto;
    min-width: 0;
    color: rgba(var(--v-theme-on-surface), 0.85);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pg-out-card__v--file {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: rgb(var(--v-theme-primary));
    text-decoration: none;
}

.pg-out-card__v--file:hover {
    text-decoration: underline;
}

.pg-out-card__v--wrap {
    white-space: normal;
}

.pg-out-card__empty {
    font-size: 0.75rem;
    color: rgba(var(--v-theme-on-surface), 0.4);
}

.pg-out-card__more {
    margin-top: 8px;
    font-size: 0.75rem;
    color: rgb(var(--v-theme-primary));
}
</style>

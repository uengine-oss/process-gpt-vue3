<template>
    <v-card v-if="instance" elevation="10" style="overflow: auto" class="is-work-height">
        <div>
            <div>
                <v-row class="ma-0 pa-4 pb-0 align-center instance-card-title">
                    <!-- 한글: 인스턴스 이름이 길 경우 줄바꿈이 가능하도록 스타일 추가 -->
                    <div
                        class="text-h5 font-weight-semibold align-center"
                        style="word-break: break-all; white-space: normal; margin-right: 5px"
                    >
                        <span v-if="isNew" class="thinking-wave-text">
                            <v-tooltip activator="parent" location="bottom"> ID: {{ instance.instId }} </v-tooltip>
                            <span
                                v-for="(char, index) in instanceName"
                                :key="index"
                                :style="{ animationDelay: `${index * 0.1}s` }"
                                class="thinking-char"
                                >{{ char === ' ' ? '\u00A0' : char }}
                            </span>
                        </span>
                        <span v-else>
                            <v-tooltip activator="parent" location="bottom"> ID: {{ instance.instId }} </v-tooltip>
                            {{ instanceName }}
                        </span>
                    </div>

                    <v-chip
                        v-if="instance.status"
                        size="x-small"
                        variant="outlined"
                        class="align-center"
                        data-testid="instance-status"
                    >
                        {{ instance.is_deleted ? 'DELETED' : instance.status }}
                    </v-chip>

                    <!--
                        대화와 프로세스를 갈아 끼우는 단추. 칸 안이 아니라 제목 줄에 둔다 —
                        지금 무엇을 보고 있는지는 화면 전체의 이야기이지 대화 칸만의 일이 아니다.
                    -->
                    <v-btn
                        v-if="simpleUi && !isNew"
                        variant="text"
                        size="x-small"
                        class="ml-3"
                        @click="chatView = chatView === 'chat' ? 'process' : 'chat'"
                    >
                        <v-icon size="16" class="mr-1">
                            {{ chatView === 'chat' ? 'mdi-sitemap-outline' : 'mdi-message-outline' }}
                        </v-icon>
                        {{ chatView === 'chat' ? '프로세스 보기' : '대화로 돌아가기' }}
                    </v-btn>
                    <div v-for="event in eventList" :key="event.tracingTag">
                        <v-btn
                            @click="fireMessage(event)"
                            color="primary"
                            rounded
                            style="font-size: 12px"
                            density="comfortable"
                            class="ml-3"
                        >
                            {{ $t('InstanceCard.sendEvent', { event: event.name ? event.name : event.type }) }}
                        </v-btn>
                    </div>
                    <v-spacer></v-spacer>
                    <div v-if="isParticipant">
                        <div v-if="instance.is_deleted">
                            <div class="text-caption">
                                {{ getRemainingTime(instance.deleted_at) }}
                            </div>
                            <v-btn @click="restoreInstance" rounded size="small" color="error" variant="flat">
                                {{ $t('InstanceCard.deleteCancel') }}
                            </v-btn>
                        </div>
                        <v-btn
                            v-else
                            @click="openDeleteDialog"
                            :style="isMobile ? '' : ''"
                            rounded
                            size="small"
                            variant="flat"
                            color="error"
                            class="ml-auto"
                        >
                            {{ $t('InstanceCard.delete') }}
                        </v-btn>
                    </div>
                </v-row>
                <div v-if="instance.instId && !isMobile" class="font-weight-medium pl-4 pr-4" style="color: gray; font-size: 14px">
                    <span v-if="!getStarterName()"
                        >{{ $t('InstanceCard.starterInfo') }}
                        <span class="loading-dots">
                            <span>.</span>
                            <span>.</span>
                            <span>.</span>
                        </span>
                    </span>
                    <span v-else>{{ $t('InstanceCard.starter') }}: {{ getStarterName() }}</span>
                    <span> | </span>
                    <span v-if="!getFormattedStartDate()"
                        >{{ $t('InstanceCard.startDateInfo') }}
                        <span class="loading-dots">
                            <span>.</span>
                            <span>.</span>
                            <span>.</span>
                        </span>
                    </span>
                    <span v-else>{{ $t('InstanceCard.startDate') }}: {{ getFormattedStartDate() }}</span>
                </div>
            </div>
        </div>
        <v-divider v-if="isMobile" class="my-2"></v-divider>

        <div :key="updatedKey">
            <div v-if="isNew" class="instance-card-Process-instance-running-box">
                <ProcessInstanceRunning :instance="instance" @updated="handleInstanceUpdated" />
            </div>
            <!--
                간소화 모드: 대화 · 산출물.

                세 요소 중 '목록'은 왼쪽 사이드바(채팅 · 인스턴스 목록)가 이미 맡고 있다.
                그래서 본문에는 나머지 둘만 둔다 — 가운데에서 지시하고, 오른쪽에서 결과를 받는다.
                탭 일곱 개로 흩어져 있던 간트 · 칸반 · 진행도 · 소스는 '프로세스 보기'로
                필요할 때만 연다.

                좁은 화면에서는 두 칸이 나란히 들어가지 않으므로 위의 단추로 하나씩 바꿔 본다.
            -->
            <div v-else-if="simpleUi" class="pg-three">
                <div v-if="isMobile" class="pg-three__switch">
                    <v-btn
                        v-for="p in simplePanes"
                        :key="p.key"
                        :variant="simplePane === p.key ? 'flat' : 'text'"
                        :color="simplePane === p.key ? 'primary' : 'default'"
                        size="small"
                        rounded
                        @click="simplePane = p.key"
                    >
                        {{ p.label }}
                    </v-btn>
                </div>

                <div ref="paneGrid" class="pg-three__grid" :style="gridStyle">
                    <section class="pg-three__col pg-three__col--main" v-show="!isMobile || simplePane === 'chat'">
                        <div class="pg-three__body">
                            <!-- 새 창을 띄우지 않고 같은 자리를 바꿔 쓴다 — 돌아올 곳이 분명하다. -->
                            <InstanceProgress
                                v-if="chatView === 'process'"
                                :key="`simple-progress-${instance?.instId}`"
                                :instance="instance"
                            />
                            <InstanceTimeline v-else :instance="instance" :participantUsers="participantUsers" />
                        </div>
                    </section>

                    <!--
                        두 칸 사이를 잡아 끌어 넓이를 바꾼다. 대화를 길게 읽을 때와
                        산출물을 들여다볼 때 필요한 넓이가 다르다.
                        좁은 화면에서는 칸을 하나씩 보므로 손잡이가 없다.
                    -->
                    <div v-if="!isMobile" class="pg-three__resizer" @mousedown="startPaneResize" @dblclick="resetPaneRatio"></div>

                    <section class="pg-three__col" v-show="!isMobile || simplePane === 'output'">
                        <div class="pg-three__body">
                            <InstanceOutput :instance="instance" :compact="true" />
                        </div>
                    </section>
                </div>
            </div>

            <div v-else style="height: 100%">
                <!-- 데스크톱: 기존 탭 -->
                <div v-if="!isMobile">
                    <v-tabs v-model="tab" color="primary">
                        <v-tab v-for="item in filteredTabItems" :key="item.value" :value="item.value">
                            {{ $t(item.label) }}
                        </v-tab>
                    </v-tabs>
                </div>

                <!-- 모바일: 버튼 형태 -->
                <div v-else class="pa-2">
                    <div class="d-flex flex-wrap ga-2">
                        <v-btn
                            v-for="item in filteredTabItems"
                            :key="item.value"
                            :variant="tab === item.value ? 'flat' : 'text'"
                            :color="tab === item.value ? '' : 'default'"
                            :style="tab === item.value ? 'background: var(--cds-text-muted); color: white;' : ''"
                            size="small"
                            @click="tab = item.value"
                        >
                            {{ $t(item.label) }}
                        </v-btn>
                    </div>
                </div>

                <v-window v-model="tab" :class="isMobile ? 'mt-0' : ''" :touch="false">
                    <v-window-item value="gantt" class="instance-card-tab-1">
                        <div class="instance-card-gantt-area" v-if="!isLoading">
                            <GanttChart
                                :key="`gantt-${updatedKey}-${instance?.instId}`"
                                :tasks="tasks"
                                :dependencies="dependencies"
                                :users="userList"
                                @task-updated="handleTaskUpdated"
                                @task-added="handleTaskAdded"
                                @task-clicked="handleTaskClicked"
                                @grid-row-clicked="handleGridRowClicked"
                                @task-tree-opened="handleTaskTreeOpened"
                                @link-event="handleLinkEvent"
                            />
                        </div>
                    </v-window-item>

                    <!-- 프로세스: 다이어그램 전체 폭(process-feedback-whole-definition-review).
                         완료 노드 더블클릭 시 드로어에서 산출물/피드백을 확인하므로 별도 업무 테이블은 제거했다. -->
                    <v-window-item value="progress" class="instance-card-tab-2">
                        <div class="instance-card-process-box" style="height: 100%">
                            <InstanceProgress :key="`progress-${updatedKey}-${instance?.instId}`" :instance="instance" ref="progress" />
                        </div>
                    </v-window-item>

                    <v-window-item value="todo" class="instance-card-tab-3">
                        <div>
                            <div class="pa-4 instance-card-kanban-board-box">
                                <div :class="buttonContainerClass" :style="buttonContainerStyle">
                                    <v-avatar v-if="mode === 'ProcessGPT'" @click="openDialog" :color="!isMobile ? '' : 'primary'">
                                        <v-tooltip activator="parent" location="left">{{ $t('InstanceCard.addTask') }}</v-tooltip>
                                        <PlusIcon stroke-width="2" />
                                    </v-avatar>
                                </div>
                                <KanbanBoard
                                    :key="`kanban-${updatedKey}-${instance?.instId}`"
                                    class="instance-card-kanban-board"
                                    :columns="columns"
                                    :users="userList"
                                    :isNotAll="false"
                                    :showAddButton="false"
                                    ref="todo"
                                />
                            </div>

                            <v-dialog v-model="dialog" persistent :fullscreen="isMobile" width="100vw" max-width="500px">
                                <TodoDialog :instId="instance.instId" :defId="instance.defId" :todolist="columns" @close="closeDialog" />
                            </v-dialog>
                        </div>
                    </v-window-item>

                    <!-- 모바일에서만 표시되는 별도 액티비티 탭 -->
                    <v-window-item value="workhistory" class="instance-card-tab-4">
                        <InstanceWorkHistory
                            :key="`workhistory-${updatedKey}-${instance?.instId}`"
                            :instance="instance"
                            @updated="handleInstanceUpdated"
                            ref="workhistory"
                        />
                    </v-window-item>
                    <!-- 채팅 -->
                    <v-window-item value="chat" class="instance-card-tab-5">
                        <Chats :isInstanceChat="true" :instanceInfo="instance" :participantUsers="participantUsers" />
                    </v-window-item>
                    <!-- 소스 -->
                    <v-window-item value="source" class="instance-card-tab-6">
                        <InstanceSource :instance="instance" />
                    </v-window-item>
                    <!-- 산출물  -->
                    <v-window-item value="output" class="instance-card-tab-7">
                        <InstanceOutput :instance="instance" />
                    </v-window-item>
                </v-window>
            </div>
        </div>
    </v-card>
    <v-card v-else>
        <!-- 존재 하지 않은 인스턴스 -->
    </v-card>
    <v-dialog v-model="deleteDialog" persistent :fullscreen="isMobile" width="90vw" max-width="500px">
        <v-card class="pa-0">
            <v-row class="ma-0 pa-4 pb-0 align-center">
                <v-card-title class="pa-0">
                    {{ $t('InstanceCard.deleteInstance') }}
                </v-card-title>
                <v-spacer></v-spacer>
                <v-btn @click="deleteDialog = false" class="ml-auto" variant="text" density="compact" icon>
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-row>
            <v-card-text class="ma-0 pa-4 pb-0">
                <div class="mb-4">
                    <strong>{{ instanceName }}</strong> {{ $t('InstanceCard.deleteInstanceMessage') }}
                </div>
                <div class="mb-2 pa-3" style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px">
                    <p class="mb-2" style="color: var(--cds-text-danger)">
                        <strong>⚠️ {{ $t('InstanceCard.warning') }}</strong>
                    </p>
                    <p class="mb-2" style="color: var(--cds-text-danger)">• {{ $t('InstanceCard.warningMessage1') }}</p>
                    <p class="mb-2" style="color: var(--cds-text-danger)">• {{ $t('InstanceCard.warningMessage2') }}</p>
                    <p class="mb-0" style="color: var(--cds-text-danger)">• {{ $t('InstanceCard.warningMessage3') }}</p>
                </div>
            </v-card-text>
            <v-row class="ma-0 pa-4">
                <v-spacer></v-spacer>
                <v-btn @click="deleteInstance" color="error" rounded variant="flat">
                    {{ $t('InstanceCard.delete') }}
                </v-btn>
            </v-row>
        </v-card>
    </v-dialog>
</template>

<script>
// import InstanceTodo from './InstanceTodo.vue';
import InstanceProgress from './InstanceProgress.vue';
import InstanceWorkHistory from './InstanceWorkHistory.vue';
import InstanceTimeline from './InstanceTimeline.vue';
import ProcessInstanceRunning from '@/components/ProcessInstanceRunning.vue';
import GanttChart from '@/components/apps/todolist/GanttChart.vue';
import KanbanBoard from '@/components/apps/todolist/KanbanBoard.vue';
import KanbanColumnConfig from './KanbanColumnConfig.vue';
import TodoDialog from './TodoDialog.vue';
import Chats from '@/views/apps/chat/Chats.vue';
import InstanceSource from './InstanceSource.vue';
import InstanceOutput from './InstanceOutput.vue';

import BackendFactory from '@/components/api/BackendFactory';
import { useCustomizerStore } from '@/stores/customizer';
const backend = BackendFactory.createBackend();

/** 대화 : 산출물 비율을 기억해 두는 자리. */
const CHAT_RATIO_KEY = 'pg.instanceChatRatio';

export default {
    setup() {
        // 설정 > 화면 간소화 스위치를 읽기 위한 것.
        return { customizer: useCustomizerStore() };
    },
    mixins: [KanbanColumnConfig],
    components: {
        InstanceProgress,
        InstanceWorkHistory,
        InstanceTimeline,
        ProcessInstanceRunning,
        GanttChart,
        KanbanBoard,
        TodoDialog,
        Chats,
        InstanceSource,
        InstanceOutput
    },
    data: () => ({
        isLoading: true,
        instance: null,
        eventList: [],
        firstWorkItem: null,
        // tab
        tab: 'workhistory',
        tabItems: [
            { value: 'workhistory', label: 'InstanceCard.activity', mobile: true },
            { value: 'progress', label: 'InstanceCard.progress', mobile: true },
            { value: 'todo', label: 'InstanceCard.kanbanBoard', mobile: true },
            { value: 'gantt', label: 'InstanceCard.ganttChart', mobile: false },
            { value: 'chat', label: 'InstanceCard.chat', mobile: true },
            { value: 'source', label: 'InstanceCard.source', mobile: true },
            { value: 'output', label: 'InstanceCard.output', mobile: true }
        ],

        // 간소화 모드에서 좁은 화면일 때 보여 줄 칸.
        simplePane: 'chat',
        simplePanes: [
            { key: 'chat', label: '대화' },
            { key: 'output', label: '산출물' }
        ],
        /** 대화 칸에 무엇을 띄울지 — 'chat' 또는 'process'. */
        chatView: 'chat',

        /**
         * 대화가 차지하는 비율(%). 나머지가 산출물이다.
         * 기본 70 — 읽는 자리가 대화이고, 산출물은 곁눈으로 확인하는 자리다.
         * 사람마다 다르게 쓰므로 브라우저에 남긴다.
         */
        chatRatio: 70,
        resizing: false,
        resizeStartX: 0,
        resizeStartRatio: 70,

        updatedKey: 0,
        deleteDialog: false,
        participantUsers: [],
        parentRedirectWatchRef: null,
        /** 이 인스턴스 자체(이름 · 상태)를 보는 구독. 남이 진행시키면 여기로 온다. */
        instanceWatchRef: null,
        workListWatchRefs: [],
        callActivityIds: new Set()
    }),
    watch: {
        $route: {
            deep: true,
            async handler(newVal, oldVal) {
                if (newVal.params.instId && newVal.params.instId !== oldVal.params.instId) {
                    await this.clearParentRedirectWatch();
                    this.tab = this.resolveInitialTab('progress');
                    await this.init();
                }
            }
        },
        async tab(newVal, oldVal) {
            if (newVal !== oldVal) {
                // 탭 상태를 localStorage에 저장
                localStorage.setItem('instanceCard-lastTab', newVal);

                // gantt 탭 선택 시 tasks와 dependencies 데이터 재로드
                if (newVal === 'gantt') {
                    // userList가 비어있으면 로드
                    if (!this.userList || this.userList.length === 0) {
                        await this.loadUserInfo();
                    }
                    // tasks 데이터 재로드
                    await this.loadTasks();
                }

                // 탭 변경 시 해당 컴포넌트 초기화
                await this.$nextTick();
                const activeComponents = this.$refs[newVal];
                if (activeComponents && activeComponents.length > 0 && activeComponents[0].init) {
                    await activeComponents[0].init({ noLoading: true });
                }

                // PC에서 progress 탭 선택 시 workhistory 컴포넌트도 초기화
                if (newVal === 'progress' && !this.isMobile) {
                    const workhistoryComponents = this.$refs.workhistory;
                    if (workhistoryComponents && workhistoryComponents.init) {
                        await workhistoryComponents.init({ noLoading: true });
                    }
                }
            }
        },
        isNew: {
            immediate: true,
            handler(newVal) {
                if (!newVal) {
                    this.tab = this.resolveInitialTab('workhistory');
                }
            }
        },
        // 인스턴스 변경 시 하위 컴포넌트 강제 리렌더링
        instance: {
            deep: true,
            handler(newVal, oldVal) {
                if (newVal && oldVal && newVal.instId !== oldVal.instId) {
                    this.updatedKey++;
                    // 현재 활성 탭의 컴포넌트 재초기화
                    this.$nextTick(async () => {
                        const activeComponents = this.$refs[this.tab];
                        if (activeComponents && activeComponents.length > 0 && activeComponents[0].init) {
                            await activeComponents[0].init({ noLoading: true });
                        }
                    });
                }
            }
        }
    },
    mounted() {
        this.watchThisInstance();
        try {
            const saved = parseInt(localStorage.getItem(CHAT_RATIO_KEY) || '', 10);
            if (!isNaN(saved) && saved >= 35 && saved <= 85) this.chatRatio = saved;
        } catch (e) {
            /* 저장소를 막아 둔 환경 */
        }

        this.tab = this.resolveInitialTab('workhistory');
        this.init({ noLoading: true });

        this.EventBus.on('todolist-updated', this.handleTodolistUpdated);
    },
    unmounted() {
        if (this.instanceWatchRef) {
            backend.watchOff(this.instanceWatchRef);
            this.instanceWatchRef = null;
        }
        this.clearParentRedirectWatch();
        this.clearWorkListWatch();
        this.EventBus.off('todolist-updated', this.handleTodolistUpdated);
    },
    computed: {
        /** 대화 : 산출물 = chatRatio : 나머지. 손잡이 자리(6px)는 사이에 둔다. */
        gridStyle() {
            if (this.isMobile) return {};
            return { gridTemplateColumns: `minmax(0, ${this.chatRatio}fr) 6px minmax(0, ${100 - this.chatRatio}fr)` };
        },
        /** 설정 > 화면 간소화. 켜면 탭 대신 목록 · 대화 · 산출물 세 칸으로 본다. */
        simpleUi() {
            return !!this.customizer.simpleUi;
        },
        id() {
            if (this.$route.params.instId) {
                return this.$route.params.instId.replace(/_DOT_/g, '.');
            } else {
                return null;
            }
        },
        filteredTabItems() {
            let items = this.tabItems;

            if (this.instance && !this.instance.defId) {
                this.tab = 'todo';
                items = items.filter((item) => item.value !== 'progress');
            }

            if (this.isMobile) {
                items = items.filter((item) => item.mobile !== false);
            } else {
                // PC에서는 액티비티 탭을 숨김 (프로세스 탭에 통합됨)
                items = items.filter((item) => item.value !== 'workhistory');
            }

            return items;
        },
        isCompleted() {
            return this.instance.status == 'COMPLETED';
        },
        isParticipant() {
            if (this.instance) {
                const uid = localStorage.getItem('uid');
                if (this.instance.participants && this.instance.participants.length > 0 && this.instance.participants.includes(uid)) {
                    return true;
                }
            }
            return false;
        },
        isNew() {
            return this.instance && this.instance.status == 'NEW';
        },
        instanceName() {
            if (this.instance && !this.isNew) {
                return this.instance.name;
            } else if (this.instance && this.isNew) {
                return this.instance.name + this.$t('runningInstance.running');
            } else {
                return '';
            }
        },
        isMobile() {
            return this.$vuetify.display.width <= 768;
        },
        buttonContainerClass() {
            return this.isMobile ? '' : 'd-flex align-center justify-end ml-2 mr-2';
        },
        buttonContainerStyle() {
            return this.isMobile ? 'position: fixed; right: 16px; bottom: 32px; z-index: 999;' : 'cursor: pointer;';
        }
    },
    methods: {
        /**
         * 이 인스턴스가 바뀌면 화면을 다시 읽는다.
         *
         * 업무(todolist)는 대화 쪽에서 이미 보고 있지만, 인스턴스의 이름과 상태는
         * 따로 있는 표라 아무도 보고 있지 않았다 — 남이 마지막 단계를 끝내도
         * 이쪽 제목은 RUNNING 그대로였다.
         */
        async watchThisInstance() {
            if (!this.id) return;
            this.instanceWatchRef = await backend.watchInstance(this.id, (latest) => {
                if (latest) this.instance = { ...this.instance, ...latest };
            });
        },

        /** 손잡이를 잡는다. /chats 의 리사이즈 핸들과 같은 방식이다. */
        startPaneResize(e) {
            this.resizing = true;
            this.resizeStartX = e.clientX;
            this.resizeStartRatio = this.chatRatio;
            document.addEventListener('mousemove', this.doPaneResize);
            document.addEventListener('mouseup', this.stopPaneResize);
            e.preventDefault();
        },

        doPaneResize(e) {
            if (!this.resizing) return;
            const box = this.$refs.paneGrid;
            if (!box) return;
            const next = this.resizeStartRatio + ((e.clientX - this.resizeStartX) / box.clientWidth) * 100;
            // 어느 쪽도 사라지지 않게 막는다 — 너무 좁으면 어차피 읽을 수 없다.
            this.chatRatio = Math.min(85, Math.max(35, next));
        },

        stopPaneResize() {
            this.resizing = false;
            document.removeEventListener('mousemove', this.doPaneResize);
            document.removeEventListener('mouseup', this.stopPaneResize);
            try {
                localStorage.setItem(CHAT_RATIO_KEY, String(Math.round(this.chatRatio)));
            } catch (e) {
                /* 저장하지 못해도 이번 화면에는 적용된다 */
            }
        },

        /** 손잡이를 두 번 누르면 기본 비율로 돌아간다. */
        resetPaneRatio() {
            this.chatRatio = 70;
            this.stopPaneResize();
        },

        resolveInitialTab(defaultTab = 'workhistory') {
            const requestedTab = this.$route.query?.tab;
            if (typeof requestedTab === 'string' && this.tabItems.some((item) => item.value === requestedTab)) {
                return requestedTab;
            }

            const lastTab = localStorage.getItem('instanceCard-lastTab');
            return lastTab || defaultTab;
        },
        async clearParentRedirectWatch() {
            if (this.parentRedirectWatchRef) {
                await backend.watchOff(this.parentRedirectWatchRef);
                this.parentRedirectWatchRef = null;
            }
        },
        async clearWorkListWatch() {
            const refs = this.workListWatchRefs || [];
            this.workListWatchRefs = [];
            await Promise.all(refs.map((ref) => backend.watchOff(ref)));
        },
        async redirectToParentIfCompleted(instance) {
            if (
                window.$mode !== 'ProcessGPT' ||
                !instance?.parent_proc_inst_id ||
                String(instance.status || '').toUpperCase() !== 'COMPLETED'
            ) {
                return false;
            }

            await this.clearParentRedirectWatch();
            const parentRouteId = instance.parent_proc_inst_id.replace(/\./g, '_DOT_');
            await this.$router.replace({
                path: `/instancelist/${parentRouteId}`,
                query: this.$route.query
            });
            return true;
        },
        async watchParentRedirect(instance) {
            if (window.$mode !== 'ProcessGPT') return;
            if (String(instance.status || '').toUpperCase() === 'COMPLETED') return;
            if (this.parentRedirectWatchRef) return;

            const childInstId = instance.instId;
            this.parentRedirectWatchRef = await backend.watchInstance(childInstId, async (latest) => {
                if (this.id !== childInstId) return;
                if (!latest) return;
                this.instance = latest;
                await this.redirectToParentIfCompleted(latest);
            });

            // The status may change between the initial query and realtime subscription.
            // Re-read once after subscribing so a root instance cannot remain visually NEW
            // while the execution engine has already moved it to RUNNING.
            const latest = await backend.getInstance(childInstId);
            if (this.id === childInstId && latest) {
                this.instance = latest;
                await this.redirectToParentIfCompleted(latest);
            }
        },
        async watchWorkListChanges() {
            if (!this.id || this.workListWatchRefs.length > 0) return;

            const refs = await Promise.all([
                backend.watchWorkList(() => this.loadTasks(), { instId: this.id }),
                backend.watchWorkList(() => this.loadTasks(), { rootInstId: this.id })
            ]);
            this.workListWatchRefs = refs.filter(Boolean);
        },
        async handleTodolistUpdated() {
            await this.loadTasks();
        },
        async handleInstanceUpdated(payload) {
            // DONE 신호를 받은 즉시 UI부터 완료 상태로 전환한다 (낙관적 업데이트)
            if (this.instance && this.instance.status === 'NEW') {
                this.instance = {
                    ...this.instance,
                    // 실제 인스턴스 상태 값은 백엔드에서 다시 받아오지만,
                    // NEW에서 벗어났다는 것만 보장되면 되므로 우선 COMPLETED로 표시한다.
                    status: 'COMPLETED'
                };
            }

            // 하위 컴포넌트 강제 리렌더링을 위해 키 증가
            this.updatedKey++;

            // 이후 백엔드에서 최신 데이터를 다시 로드 (느려도 UI는 이미 완료 화면)
            await this.init({ noLoading: true });
        },
        async init(options = {}) {
            var me = this;
            me.$try({
                context: me,
                noLoading: options.noLoading,
                action: async () => {
                    if (!me.id) return;
                    me.isLoading = true;
                    await me.clearWorkListWatch();

                    const serverInstance = await backend.getInstance(me.id);

                    if (serverInstance) {
                        // 로컬에서 이미 NEW가 아닌 상태로 전환했다면,
                        // 서버가 아직 NEW라고 하더라도 NEW로 되돌리지 않도록 상태를 병합한다.
                        if (me.instance && me.instance.status && me.instance.status !== 'NEW' && serverInstance.status === 'NEW') {
                            me.instance = {
                                ...serverInstance,
                                status: me.instance.status
                            };
                        } else {
                            me.instance = serverInstance;
                        }
                    } else {
                        me.instance = serverInstance;
                    }

                    // 업무는 있는데 인스턴스가 없는 경우가 있다 — 엔진이 아직 줄을 남기기 전이거나,
                    // 지워진 인스턴스의 업무가 남은 경우다. 그때 빈 화면을 내밀면 고장으로 보이므로,
                    // 어느 업무에서 왔는지 알면 그 업무 화면으로 돌려보낸다.
                    if (!me.instance) {
                        const fromTask = me.$route.query && me.$route.query.task;
                        if (fromTask) {
                            me.$router.replace(`/todolist/${fromTask}`);
                            return;
                        }
                    }

                    if (me.instance) {
                        if (await me.redirectToParentIfCompleted(me.instance)) return;
                        await me.watchParentRedirect(me.instance);

                        me.eventList = await backend.getEventList(me.instance.instId);
                        await me.loadCallActivityIds();

                        // 시작자와 시작일시 정보를 위해 첫 번째 workItem 가져오기
                        const workItems = await backend.getWorkList({ instId: me.id });
                        if (workItems && workItems.length > 0) {
                            // 시작 날짜가 가장 빠른 workItem 찾기 (첫 번째 작업)
                            me.firstWorkItem = workItems.reduce((earliest, current) => {
                                if (!earliest.startDate) return current;
                                if (!current.startDate) return earliest;
                                return new Date(current.startDate) < new Date(earliest.startDate) ? current : earliest;
                            });
                        }

                        // 참여자 정보 가져오기
                        if (me.instance.participants && me.instance.participants.length > 0) {
                            const allUsers = await backend.getUserList({});
                            me.participantUsers = me.instance.participants.map((participantId) => {
                                const user = allUsers.find((u) => u.id === participantId);
                                return user || { id: participantId, username: '알 수 없음', email: '', profile: null };
                            });
                        }
                    }

                    // // 인스턴스 변경 시 하위 컴포넌트 강제 리렌더링
                    // me.updatedKey++;

                    // // 인스턴스 로드 후 하위 컴포넌트 초기화
                    // await me.$nextTick();
                    // const activeComponents = me.$refs[me.tab];
                    // if (activeComponents && activeComponents.length > 0 && activeComponents[0].init) {
                    //     await activeComponents[0].init();
                    // }

                    await me.loadTasks();
                    await me.watchWorkListChanges();

                    me.isLoading = false;
                }
            });
        },
        async loadCallActivityIds() {
            this.callActivityIds = new Set();
            const defId = this.instance?.defId;
            if (!defId || !backend.getRawDefinition) return;

            try {
                const rawDefinition = await backend.getRawDefinition(defId, null);
                const parsedDefinition = typeof rawDefinition === 'string' ? JSON.parse(rawDefinition) : rawDefinition;
                const rawProcessDefinition = parsedDefinition?.definition || parsedDefinition?.processDefinition || parsedDefinition || {};
                const definition = typeof rawProcessDefinition === 'string' ? JSON.parse(rawProcessDefinition) : rawProcessDefinition;
                const activities = Array.isArray(definition.activities) ? definition.activities : [];
                const callActivityIds = activities
                    .filter((activity) => String(activity?.type || '').toLowerCase() === 'callactivity')
                    .map((activity) => activity?.id)
                    .filter(Boolean);
                this.callActivityIds = new Set(callActivityIds);
            } catch (error) {
                console.warn('[InstanceCard] Failed to load CallActivity metadata for todo filtering.', error);
            }
        },
        isCallActivityWorkItem(task) {
            if (!task) return false;
            const type = String(task.type || task.activityType || task.bpmnType || '').toLowerCase();
            if (type === 'callactivity') return true;
            return this.callActivityIds.has(task.tracingTag);
        },
        async loadTasks() {
            var me = this;
            let result = [];
            const tasks = await backend.getWorkList({ instId: me.id });
            result = result.concat(tasks);
            // 바로 아래 자식 태스크 추가
            for (const task of tasks) {
                let childTaks = await backend.getWorkList({ instId: task.taskId });
                const updatedWorklist = childTaks.map((item) => ({
                    ...item,
                    parent: task.taskId // 인스턴스가 부모
                }));
                result = result.concat(updatedWorklist);
            }
            me.tasks = result;
            const kanbanTasks = me.tasks.filter((task) => !me.isCallActivityWorkItem(task));
            const rawDependencies = await backend.getTaskDependencyByInstId(me.id);
            const dependencies = Array.isArray(rawDependencies) ? rawDependencies : [];
            if (!Array.isArray(rawDependencies) && rawDependencies != null) {
                console.warn(`[InstanceCard] getTaskDependencyByInstId returned non-array. skipping as empty array.`, rawDependencies);
            }
            me.dependencies = me.settingTaskDependency(dependencies, me.tasks);
            me.columns.forEach((column) => {
                if (column.id == 'IN_PROGRESS') {
                    column.tasks = kanbanTasks.filter(
                        (task) =>
                            task.status === 'SUBMITTED' ||
                            task.status === 'IN_PROGRESS' ||
                            task.status === 'NEW' ||
                            task.status === 'Running'
                    );
                } else {
                    column.tasks = kanbanTasks.filter((task) => task.status === column.id);
                }
            });
        },
        settingTaskDependency(dependencies, tasks) {
            let result = [];
            result = tasks.reduce((dependencies, task) => {
                if (task.referenceIds && task.referenceIds.length > 0) {
                    const taskDeps = task.referenceIds.map((refId) => ({
                        id: this.generateUUID(),
                        taskId: task.taskId,
                        dependsId: refId
                    }));
                    return [...dependencies, ...taskDeps];
                }
                return dependencies;
            }, []);

            result = [...new Set([...result, ...dependencies])];

            return result;
        },
        generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = (Math.random() * 16) | 0;
                const v = c === 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            });
        },
        delay(time) {
            return new Promise((resolve) => setTimeout(resolve, time));
        },
        async fireMessage(event) {
            await backend.fireMessage(this.instance.instId, event);
            this.init({ noLoading: true });
            const progressComponent = this.$refs.progress[0];
            if (progressComponent) {
                progressComponent.initStatus();
            }
        },
        openDeleteDialog() {
            this.deleteDialog = true;
        },
        deleteInstance() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (!me.id) return;
                    await backend.deleteInstance(me.id);
                    me.deleteDialog = false;
                    me.EventBus.emit('instances-updated');
                    me.$router.push('/todolist');
                },
                successMsg: this.$t('successMsg.instanceDelete')
            });
        },
        restoreInstance() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    await backend.restoreInstance(me.id);
                    me.instance.is_deleted = false;
                    me.instance.deleted_at = null;
                }
            });
        },

        async handleTaskUpdated(task) {
            await backend.putWorklist(task.taskId, task);
        },
        async handleTaskAdded(task) {
            task.projectId = this.instance.projectId;
            if (task.parent == 0) {
                task.instId = this.instance.instId;
            } else {
                task.instId = task.parent;
            }
            await backend.putWorklist(null, task);
        },
        async handleTaskClicked(event) {
            console.log(event);
        },
        async handleGridRowClicked(event) {
            console.log(event);
        },
        async handleLinkEvent(event) {
            let link = event.link;
            if (event.type == 'add') {
                await backend.putTaskDependency({
                    id: link.id,
                    task_id: link.target,
                    depends_id: link.source,
                    type: link.type
                });
            } else if (event.type == 'delete') {
                await backend.deleteTaskDependency(link.id);
            }
        },
        async handleTaskTreeOpened(event) {
            var me = this;
            const rootTaskId = event.id;
            let rootTask = this.tasks.find((x) => x.taskId == rootTaskId);
            if (rootTask.isOpened) return;

            let result = [];
            const tasks = await backend.getWorkList({ instId: rootTaskId });
            result = result.concat(tasks);
            // 바로 아래 자식 태스크 추가
            for (let task of tasks) {
                task.parent = rootTaskId;
                let childTaks = await backend.getWorkList({ instId: task.taskId });
                const updatedWorklist = childTaks.map((item) => ({
                    ...item,
                    parent: task.taskId
                }));
                result = result.concat(updatedWorklist);
            }
            me.tasks = me.tasks.concat(result);

            const rootTaskDependencies = await backend.getTaskDependencyByInstId(rootTaskId);
            me.dependencies = me.dependencies.concat(rootTaskDependencies);

            rootTask.isOpened = true;
        },
        openDialog() {
            this.dialog = true;
        },
        closeDialog() {
            this.dialog = false;
        },
        getRemainingTime(deletedAt) {
            if (!deletedAt) return '';

            const deletedDate = new Date(deletedAt);
            const finalDeleteDate = new Date(deletedDate);
            finalDeleteDate.setDate(finalDeleteDate.getDate() + 7);

            const now = new Date();
            const timeDiff = finalDeleteDate - now;

            if (timeDiff <= 0) {
                return '완전 삭제됨';
            }

            const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

            if (days >= 1) {
                return `${days}일 후 삭제 예정`;
            } else if (hours >= 1) {
                return `${hours}시간 후 삭제 예정`;
            } else {
                return `${minutes}분 후 삭제 예정`;
            }
        },
        getStarterName() {
            if (!this.firstWorkItem) {
                return; // 로딩 중 - undefined 반환
            }
            if (this.firstWorkItem.username) {
                return this.firstWorkItem.username;
            } else if (this.firstWorkItem.endpoint) {
                return this.firstWorkItem.endpoint;
            }
        },
        getFormattedStartDate() {
            if (!this.firstWorkItem) {
                return;
            }
            if (this.firstWorkItem.startDate) {
                let dateStr = this.firstWorkItem.startDate;
                if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
                    dateStr += 'Z';
                }
                const date = new Date(dateStr);
                const kst = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
                const year = kst.getFullYear();
                const month = String(kst.getMonth() + 1).padStart(2, '0');
                const day = String(kst.getDate()).padStart(2, '0');
                const hours = String(kst.getHours()).padStart(2, '0');
                const minutes = String(kst.getMinutes()).padStart(2, '0');
                return `${year}.${month}.${day} / ${hours}:${minutes}`;
            }
        }
    }
};
</script>

<style>
.top-section {
    flex: 3;
    margin-bottom: 16px;
}
.bottom-section {
    flex: 7;
}
.list-card {
    width: 100%;
    height: 100%;
}

/* Vuetify 3 반응형 탭 스타일 */
.v-tabs--vertical {
    align-items: stretch;
}

.v-tabs--vertical .v-tab {
    justify-content: flex-start !important;
    text-align: left;
    min-height: 48px;
}

/*
 * 간소화 인스턴스 화면 — 목록 · 대화 · 산출물.
 *
 * 높이를 뷰포트에서 직접 계산한다. 위쪽 조상들(v-card 안의 래퍼)에 높이가
 * 없어서 백분율이 이어지지 않기 때문이다. 카드 자체가 쓰는 계산식
 * (.is-work-height)에 제목 줄 높이를 더 뺀 값이다.
 */
.pg-three {
    --pg-three-chrome: 240px;
    padding: 0 12px 12px;
}

.pg-three__switch {
    display: flex;
    justify-content: center;
    gap: 6px;
    padding: 8px 0;
}

.pg-three__grid {
    display: grid;
    /* 기본 7 : 3. 실제 값은 gridStyle 이 덮어쓴다. */
    grid-template-columns: minmax(0, 70fr) 6px minmax(0, 30fr);
    gap: 6px;
    height: calc(100vh - var(--pg-three-chrome));
    min-height: 360px;
}

.pg-three__col {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    border-radius: 12px;
    overflow: hidden;
    background: rgb(var(--v-theme-surface));
}

/*
 * 대화는 카드 본문 그 자체다. 테두리를 두르면 카드 안에 카드가 생겨
 * 선이 두 겹으로 보인다. 옆의 산출물만 따로 담긴 것으로 두른다.
 */
.pg-three__col:not(.pg-three__col--main) {
    border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}



.pg-three__body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
}

/*
 * 안에 들어가는 화면들은 원래 화면 높이(100vh 계산식)를 스스로 정한다.
 * 칸 안에 넣으면 그 값이 칸보다 커져서 아래쪽 — 채팅 입력줄 — 이 잘려 나간다.
 * 칸 안에서는 칸 높이를 따르게 한다.
 */
.pg-three__body > .v-card,
.pg-three__body .mainbox,
.pg-three__body .right-part,
.pg-three__body .chat-info-view-wrapper-chats {
    height: 100% !important;
    min-height: 0 !important;
}

/* 두 칸 사이의 손잡이. 평소에는 옅은 선이고, 올리면 또렷해진다. */
.pg-three__resizer {
    align-self: stretch;
    width: 6px;
    border-radius: 3px;
    cursor: col-resize;
    background: transparent;
    transition: background 0.15s ease;
}

.pg-three__resizer:hover,
.pg-three__resizer:active {
    background: rgba(var(--v-theme-primary), 0.35);
}

@media (max-width: 768px) {
    /* 한 칸씩 본다 — 위의 단추로 고른다. */
    .pg-three {
        --pg-three-chrome: 200px;
        padding: 0 8px 8px;
    }

    .pg-three__grid {
        grid-template-columns: 1fr;
        gap: 12px;
        /* 보이는 칸 하나가 남은 높이를 다 쓰게 한다 — 숨긴 칸은 줄을 차지하지 않는다. */
        grid-auto-rows: minmax(0, 1fr);
    }
}
</style>

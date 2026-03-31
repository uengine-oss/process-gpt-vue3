<template>
    <!-- <BrowserAgent v-if="openBrowserAgent" :html="html" :workItem="workItem" :doneWorkItemList="doneWorkItemList" /> -->
    <div class="agent-monitor" :class="{ 'actions-mode': isActionsMode }">
        <div class="task-area" ref="taskArea">
            <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>

            <EventTimeline
                v-show="!isInitialLoading && (timeline.length > 0 || isActionsMode)"
                :timeline="timeline"
                :human-query-answers="humanQueryAnswers"
                :expanded-tasks="expandedTasks"
                :slide-indexes="slideIndexes"
                :tool-usage-status-by-task="toolUsageStatusByTask"
                :todo-status="todoStatus"
                :browser-iframe-url="browserIframeUrl"
                :howToUseInfo="howToUseInfo"
                @update:human-query-answers="humanQueryAnswers = $event"
                @update:expanded-tasks="expandedTasks = $event"
                @update:slide-indexes="slideIndexes = $event"
                @on-cancel-human-query="onCancelHumanQuery"
                @on-confirm-human-query="onConfirmHumanQuery"
                @submit-task="submitTask"
                @previous-slide="previousSlide"
                @next-slide="nextSlide"
                @go-to-slide="goToSlide"
                @toggle-task-expansion="toggleTaskExpansion"
                @open-browser-dialog="openBrowserDialog"
                @browser-use-completed="handleBrowserUseCompleted"
            />

            <!-- 빈 상태 -->
            <!-- <EmptyState 
                v-if="!isInitialLoading && timeline.length === 0 && !isActionsMode"
                :is-queued="isQueued"
                :orchestration-options="orchestrationOptions"
                :selected-orchestration-method="selectedOrchestrationMethod"
                :show-download-button="showDownloadButton"
                @select-orchestration-method="selectOrchestrationMethod"
                @start-task="startTask"
                @download-browser-agent="downloadBrowserAgent"
            /> -->
            <div v-if="!isInitialLoading && timeline.length === 0 && !isActionsMode && !isQueued">
                <AgentSelectField :model-value="selectedAgent" :backend="backend" :is-execute="true" @update:model-value="updateWorkItem" />
            </div>

            <div v-if="timeline.length === 0" class="empty-state">
                <div v-if="isQueued">
                    <div
                        v-for="(char, index) in $t('agentMonitor.workQueued')"
                        :key="index"
                        :style="{ animationDelay: `${index * 0.1}s` }"
                        class="thinking-char"
                    >
                        {{ char === ' ' ? '\u00A0' : char }}
                    </div>
                    <p>{{ $t('agentMonitor.workStarted') }}</p>
                </div>
                <div v-else>
                    <h3>{{ $t('agentMonitor.noWorkInProgress') }}</h3>
                    <p>{{ $t('agentMonitor.workStarted') }}</p>
                </div>
            </div>

            <!-- 로딩 상태 -->
            <div v-if="isLoading" class="feedback-loading">
                <div class="loading-spinner"></div>
                <span>{{ getLoadingMessage() }}</span>
                <button @click="stopTask" class="stop-button" aria-label="중단">⏹</button>
            </div>
        </div>

        <!-- 채팅 입력 -->
        <div v-if="tasks.length > 0 || isActionsMode" class="chat-input-wrapper">
            <Chat
                :messages="chatMessages"
                :agentInfo="{ isRunning: isLoading, isConnection: false }"
                :disableChat="isLoading"
                :userInfo="{ name: '', email: '' }"
                :chatRoomId="getTaskIdFromWorkItem()"
                type="monitor"
                @sendMessage="submitChat"
                @stopMessage="stopTask"
                @uploadedFile="handleUploadedFile"
            >
                <template #custom-input-tools>
                    <div v-if="isGeneralAgent" class="simple-dropdown" @click="toggleDropdown" ref="dropdown">
                        <div class="dropdown-trigger">
                            <span class="dropdown-label">{{ $t('agentMonitor.researchMethod') }}: {{ selectedOrchestrationLabel }}</span>
                        </div>
                        <div v-if="isDropdownOpen" class="dropdown-menu">
                            <div
                                v-for="option in orchestrationOptions"
                                :key="option.value"
                                class="dropdown-item"
                                :class="{ active: selectedOrchestrationMethod === option.value }"
                                @click.stop="selectOption(option.value)"
                            >
                                <div class="option-left">
                                    <Icons :icon="option.icon" class="option-icon" />
                                    <span class="option-label">{{ option.label }}</span>
                                </div>
                                <span v-if="selectedOrchestrationMethod === option.value" class="check-icon">✓</span>
                            </div>
                        </div>
                    </div>
                </template>
            </Chat>
        </div>

        <v-dialog v-model="browserDialog" max-width="70%" persistent>
            <v-card class="browser-dialog">
                <v-card-title class="browser-dialog-header">
                    <span>브라우저 자동화 결과</span>
                    <v-btn icon @click="closeBrowserDialog" class="close-btn">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="browser-dialog-content">
                    <iframe :src="browserIframeUrl" class="browser-dialog-iframe" frameborder="0" allowfullscreen> </iframe>
                </v-card-text>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import ChatModule from '@/components/ChatModule.vue';
import BrowserAgent from '@/components/BrowserAgent.vue';
import Chat from '@/components/ui/Chat.vue';
import EventTimeline from '@/components/ui/EventTimeline.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import AgentSelectField from '@/components/ui/field/AgentSelectField.vue';

import BackendFactory from '@/components/api/BackendFactory';

export default {
    mixins: [ChatModule],
    components: {
        Chat,
        BrowserAgent,
        EventTimeline,
        EmptyState,
        AgentSelectField
    },
    props: {
        html: {
            type: String,
            required: true
        },
        workItem: {
            type: Object
        },
        isActionsMode: {
            type: Boolean,
            default: false
        },
        // chat인포 관련
        howToUseInfo: {
            type: Object,
            default: null
        },
        selectedAgentType: {
            type: String,
            default: null
        },
        // 자동 전송 메시지 (메인 채팅에서 전달)
        autoMessage: {
            type: String,
            default: null
        }
    },
    data() {
        return {
            backend: null,

            events: [],
            channel: null,
            eventsPollingTimer: null,
            isPollingEvents: false,
            slideIndexes: {},
            expandedTasks: {},
            errorMessage: null,
            todoStatus: null,
            chatMessages: [],
            isCancelled: false,
            isLoading: false,
            isInitialLoading: true, // 초기 데이터 로딩 상태
            latestFormData: null,
            selectedOrchestrationMethod: null, // 통합된 오케스트레이션 방식
            isDropdownOpen: false, // 드롭다운 열림 상태
            openBrowserAgent: false,
            downloadedBrowserAgent: false,
            doneWorkItemList: [],
            // 이벤트 기반 즉시 표시 및 1회 동기화 플래그
            hasReceivedEvent: false,
            hasSyncedTodoStatusOnce: false,
            // human_asked 응답 관리
            humanQueryAnswers: {},
            // 공통 옵션 배열
            orchestrationOptions: [
                {
                    titleKey: 'AgentSelectInfo.orchestration.crewaiDeepResearch.title',
                    value: 'crewai-deep-research',
                    label: this.$t('AgentSelectInfo.orchestration.crewaiDeepResearch.title'),
                    startLabel: 'CrewAI Deep Research',
                    icon: 'playoff',
                    descKey: 'AgentSelectInfo.orchestration.crewaiDeepResearch.description',
                    costKey: 'AgentSelectInfo.cost.medium',
                    detailDesc: {
                        title: 'AgentSelectInfo.orchestration.crewaiDeepResearch.detailDesc.title',
                        details: [
                            { title: 'AgentSelectInfo.orchestration.crewaiDeepResearch.detailDesc.details.0.title' },
                            { title: 'AgentSelectInfo.orchestration.crewaiDeepResearch.detailDesc.details.1.title' },
                            { title: 'AgentSelectInfo.orchestration.crewaiDeepResearch.detailDesc.details.2.title' }
                        ]
                    }
                },
                {
                    titleKey: 'AgentSelectInfo.orchestration.deepResearchCustom.title',
                    value: 'deep-research-custom',
                    label: this.$t('AgentSelectInfo.orchestration.deepResearchCustom.title'),
                    startLabel: 'Deep Research Custom',
                    icon: 'playoff',
                    descKey: 'AgentSelectInfo.orchestration.deepResearchCustom.description',
                    costKey: 'AgentSelectInfo.cost.medium',
                    detailDesc: {
                        title: 'AgentSelectInfo.orchestration.deepResearchCustom.detailDesc.title',
                        details: [
                            { title: 'AgentSelectInfo.orchestration.deepResearchCustom.detailDesc.details.0.title' },
                            { title: 'AgentSelectInfo.orchestration.deepResearchCustom.detailDesc.details.1.title' },
                            { title: 'AgentSelectInfo.orchestration.deepResearchCustom.detailDesc.details.2.title' }
                        ]
                    }
                },
                {
                    titleKey: 'AgentSelectInfo.orchestration.crewaiAction.title',
                    value: 'crewai-action',
                    label: this.$t('AgentSelectInfo.orchestration.crewaiAction.title'),
                    startLabel: 'CrewAI Action',
                    icon: 'flowchart',
                    descKey: 'AgentSelectInfo.orchestration.crewaiAction.description',
                    costKey: 'AgentSelectInfo.cost.low',
                    detailDesc: {
                        title: 'AgentSelectInfo.orchestration.crewaiAction.detailDesc.title',
                        details: [
                            { title: 'AgentSelectInfo.orchestration.crewaiAction.detailDesc.details.0.title' },
                            { title: 'AgentSelectInfo.orchestration.crewaiAction.detailDesc.details.1.title' },
                            { title: 'AgentSelectInfo.orchestration.crewaiAction.detailDesc.details.2.title' }
                        ]
                    }
                }
            ],

            todolistChannel: null,
            // 브라우저 자동화 에이전트 관련
            showBrowserIframe: false,
            browserIframeUrl: '',
            browserDialog: false,

            selectedAgent: {
                agent: '',
                agentMode: 'draft',
                orchestration: null
            }
        };
    },
    computed: {
        tasks() {
            const taskMap = new Map();
            const crewCompletedJobIds = new Set();
            const humanAskedTasks = [];
            const humanRespondedJobIds = new Set();
            const humanResponseByJobId = {};

            // 단일 루프로 이벤트 처리
            this.events.forEach((e) => {
                const { event_type, crew_type, data, job_id, id, timestamp } = e;
                const jobId = job_id || data?.job_id || id;

                if (event_type === 'crew_completed') {
                    crewCompletedJobIds.add(jobId);
                } else if (event_type === 'human_response') {
                    humanRespondedJobIds.add(jobId);
                    humanResponseByJobId[jobId] = e;
                } else if (event_type === 'task_started') {
                    // console.log('[AgentMonitor] task_started 이벤트:', {
                    //     jobId,
                    //     data,
                    //     task_description: data?.task_description,
                    //     goal: data?.goal,
                    //     name: data?.name,
                    //     role: data?.role
                    // })
                    taskMap.set(jobId, {
                        id,
                        jobId,
                        goal: data?.goal || 'Task',
                        name: data?.name || '',
                        role: data?.role || 'Agent',
                        crewType: crew_type || 'default',
                        startTime: timestamp,
                        isCompleted: false,
                        outputRaw: null,
                        content: null,
                        isCrewCompleted: false,
                        agentProfile: data?.agent_profile,
                        isHumanAsked: false,
                        taskDescription: data?.task_description || null
                    });
                    // console.log('[AgentMonitor] 생성된 task 객체:', taskMap.get(jobId))
                } else if (event_type === 'task_completed' && taskMap.has(jobId)) {
                    const task = taskMap.get(jobId);
                    task.isCompleted = true;
                    task.outputRaw = data || null;
                    task.content = this.resolvePrimaryValue(data || null, task.crewType);
                    if (task.crewType === 'browser-use') {
                        task.completedEventId = e.id;
                    }
                } else if (event_type === 'error') {
                    // job_id 매칭 없이 독립 태스크 생성
                    const friendlyText = data && (data.friendly || data.message || data.msg || data.raw_error);
                    const message = friendlyText || '오류가 발생했습니다';
                    const key = id;
                    taskMap.set(key, {
                        id,
                        jobId: key,
                        goal: data?.goal,
                        name: data?.name,
                        role: data?.role,
                        crewType: 'text',
                        startTime: timestamp,
                        isCompleted: true,
                        outputRaw: data || null,
                        content: message,
                        isCrewCompleted: false,
                        agentProfile: data?.agent_profile || null,
                        isHumanAsked: false,
                        isError: true
                    });
                } else if (event_type === 'human_asked') {
                    // human_asked 이벤트를 별도 작업으로 추가 (블루톤 카드용 텍스트 구성)
                    const baseDescription = this.$t('AgentSelectInfo.humanApproval.description');
                    const response = humanResponseByJobId[jobId] || null;
                    humanAskedTasks.push({
                        id,
                        jobId,
                        goal: baseDescription,
                        name: this.$t('AgentSelectInfo.humanApproval.title'),
                        role: data?.role || 'System',
                        crewType: 'human_asked',
                        startTime: timestamp,
                        isCompleted: Boolean(response),
                        outputRaw: null,
                        content: null,
                        isCrewCompleted: false,
                        agentProfile: data?.agent_profile || null,
                        isHumanAsked: true,
                        humanQueryData: {
                            type: data?.type || 'text',
                            options: Array.isArray(data?.options) ? data.options : [],
                            text: data?.text || ''
                        },
                        humanResponse: response,
                        eventRow: e
                    });
                } else if (event_type === 'human_checked') {
                    const content = data.data;
                    taskMap.set(jobId, {
                        id,
                        jobId,
                        goal: data?.goal || 'Task',
                        name: data?.name || '',
                        role: data?.role || 'Agent',
                        crewType: crew_type || 'default',
                        startTime: timestamp,
                        isCompleted: true,
                        outputRaw: data || null,
                        content: content || null,
                        isCrewCompleted: false,
                        agentProfile: data?.agent_profile,
                        isHumanAsked: false,
                        taskDescription: data?.message || null
                    });
                    this.handleHumanCheckedEvent(e);
                }
            });

            // crew_completed 마킹 - job_id 기준으로 처리
            crewCompletedJobIds.forEach((jobId) => {
                if (taskMap.has(jobId)) {
                    taskMap.get(jobId).isCrewCompleted = true;
                }
            });

            // human_response 존재 시 해당 human_asked 카드를 완료 처리
            humanAskedTasks.forEach((task) => {
                if (humanRespondedJobIds.has(task.jobId)) {
                    task.isCompleted = true;
                    task.humanResponse = task.humanResponse || humanResponseByJobId[task.jobId] || null;
                }
            });

            // 일반 작업과 human_asked 작업을 합치고 시간 순으로 정렬
            const allTasks = [...Array.from(taskMap.values()), ...humanAskedTasks];
            return allTasks.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
        },
        showDownloadButton() {
            return this.selectedOrchestrationMethod === 'browser-automation-agent' && !this.downloadedBrowserAgent;
        },
        toolUsageStatusByTask() {
            const usageMap = {};
            // 이벤트를 시간 순으로 처리하고, 도구 시작-완료 매칭을 스택(LIFO) 방식으로 처리
            this.events
                .slice()
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                .forEach((e) => {
                    const { event_type, data, job_id, id, crew_type } = e;
                    const jobId = job_id || data?.job_id || id;
                    if (!usageMap[jobId]) usageMap[jobId] = [];

                    if (event_type === 'tool_usage_started') {
                        usageMap[jobId].push({
                            tool_name: data.tool_name || crew_type,
                            query: data.query || null,
                            info: null,
                            status: 'searching'
                        });
                    } else if (event_type === 'tool_usage_finished') {
                        const list = usageMap[jobId];
                        // LIFO 방식으로 마지막 시작 이벤트를 먼저 처리
                        for (let i = list.length - 1; i >= 0; i--) {
                            if (list[i].tool_name === data.tool_name && list[i].status === 'searching') {
                                list[i].status = 'done';
                                list[i].info = data.info || data.message || null;
                                break;
                            }
                        }
                    } else if (event_type === 'task_working') {
                        usageMap[jobId].push({
                            tool_name: crew_type,
                            query: data.query || null,
                            info: data.info || data.message || null,
                            status: 'done'
                        });
                    }
                });
            return usageMap;
        },
        isQueued() {
            // 유효한 orchestration 값이 있는지 확인
            const validOrch = this.todoStatus && this.todoStatus.agent_orch !== null && this.todoStatus.agent_orch !== '';
            // 시작 직후(첫 이벤트 이전)에도 대기 문구가 뜨도록 hasReceivedEvent 조건 제거
            return (
                this.todoStatus &&
                this.todoStatus.status === 'IN_PROGRESS' &&
                (this.todoStatus.agent_mode === 'DRAFT' || this.todoStatus.agent_mode === 'COMPLETE') &&
                validOrch
            );
        },
        timeline() {
            const taskItems = this.tasks.map((task) => ({ type: 'task', time: task.startTime, payload: task }));
            const chatItems = this.chatMessages.map((msg) => ({ type: 'chat', time: msg.time, payload: msg }));
            const result = [...taskItems, ...chatItems].sort((a, b) => new Date(a.time) - new Date(b.time));
            return result;
        },
        selectedOrchestrationLabel() {
            if (!this.selectedOrchestrationMethod) {
                return this.$t('agentMonitor.researchMethod');
            }
            const selectedOption = this.orchestrationOptions.find((option) => option.value === this.selectedOrchestrationMethod);
            return selectedOption ? selectedOption.label : this.$t('agentMonitor.researchMethod');
        },
        isGeneralAgent() {
            if (this.selectedAgent) {
                return (
                    this.selectedAgent.orchestration === 'crewai-action' ||
                    this.selectedAgent.orchestration === 'crewai-deep-research' ||
                    this.selectedAgent.orchestration === 'deep-research-custom'
                );
            }
            return false;
        },
        // 에이전트가 진행 중이거나 대기열에 있는 상태
        isAgentBusy() {
            return this.isQueued || this.timeline.length > 0 || this.isLoading;
        },
        isDraftBrowserUseMode() {
            return (
                this.todoStatus &&
                this.todoStatus.draft &&
                this.todoStatus.agent_orch === 'browser-automation-agent' &&
                this.todoStatus.agent_mode === 'DRAFT' &&
                this.todoStatus.draft_status === 'COMPLETED'
            );
        }
    },
    watch: {
        isAgentBusy: {
            handler(newVal) {
                this.$emit('update:agent-busy', newVal);
            },
            immediate: true
        },
        isQueued: {
            handler(newVal) {
                if (newVal && this.events.length === 0) {
                    this.startEventsPolling();
                } else {
                    this.stopEventsPolling();
                }
            },
            immediate: true
        },
        events: {
            handler(newVal) {
                if (Array.isArray(newVal) && newVal.length > 0) {
                    this.stopEventsPolling();
                }
            },
            deep: true
        },
        workItem: {
            deep: true,
            async handler(newVal) {
                this.isInitialLoading = true;
                if (newVal.worklist.orchestration) {
                    this.selectedOrchestrationMethod = newVal.worklist.orchestration;
                }
                await this.loadData();
                await this.fetchTodoStatus();
                this.cleanup();
                this.setupRealtimeSubscription(newVal.worklist.taskId);

                if (newVal && !this.selectedAgentType) {
                    this.selectedAgent = {
                        agent: newVal.worklist.endpoint || '',
                        agentMode: newVal.worklist.agentMode.toLowerCase() || 'none',
                        orchestration: newVal.worklist.orchestration || null
                    };
                }

                // autoMessage가 있고 상태가 NEW이면 자동 전송
                if (this.autoMessage && this.todoStatus && this.todoStatus.status === 'NEW') {
                    this.$nextTick(() => {
                        this.submitChat({ text: this.autoMessage });
                        this.$emit('auto-message-sent');
                    });
                }
            }
        }
    },
    methods: {
        startEventsPolling() {
            if (this.eventsPollingTimer) return;
            this.eventsPollingTimer = setInterval(async () => {
                if (this.isPollingEvents) return;
                if (!this.isQueued || this.events.length > 0) {
                    this.stopEventsPolling();
                    return;
                }
                this.isPollingEvents = true;
                try {
                    await this.loadData();
                } finally {
                    this.isPollingEvents = false;
                }
            }, 3000);
        },
        stopEventsPolling() {
            if (this.eventsPollingTimer) {
                clearInterval(this.eventsPollingTimer);
                this.eventsPollingTimer = null;
            }
        },
        // ========================================
        // 🔧 공통 유틸리티 메서드들
        // ========================================
        isFileLikeValue(value) {
            if (!value) return false;
            if (typeof value === 'object') {
                return !!(value.path || value.name || value.file_path || value.file_name || value.url || value.publicUrl || value.public_url);
            }
            if (typeof value === 'string') {
                const lowered = value.toLowerCase();
                if (lowered.startsWith('http://') || lowered.startsWith('https://')) return true;
                if (lowered.includes('/storage/')) return true;
                return ['.docx', '.hwpx', '.pdf', '.doc'].some((ext) => lowered.endsWith(ext));
            }
            return false;
        },
        hasFilePayload(payload) {
            if (!payload || typeof payload !== 'object') return false;
            if (Array.isArray(payload)) {
                return payload.some((item) => this.isFileLikeValue(item));
            }
            const fileListKeys = ['docx_files', 'hwpx_files', 'files', 'results', 'data'];
            if (fileListKeys.some((key) => Array.isArray(payload[key]) && payload[key].length > 0)) {
                return true;
            }
            return Object.values(payload).some((value) => this.isFileLikeValue(value));
        },
        handleError(error, defaultMessage = '오류가 발생했습니다') {
            const message = error?.message || error || defaultMessage;
            this.errorMessage = message;
            console.error(message, error);
        },
        validateTaskId() {
            const taskId = this.getTaskIdFromWorkItem();
            if (!taskId) {
                this.handleError(null, 'taskId를 찾을 수 없습니다.');
                return null;
            }
            return taskId;
        },
        parseJson(data, fallback = {}) {
            if (!data) return fallback;
            try {
                return typeof data === 'string' ? JSON.parse(data) : data;
            } catch {
                return fallback;
            }
        },

        safeArrayParse(data) {
            const parsed = this.parseJson(data, []);
            return Array.isArray(parsed) ? parsed : [];
        },
        // HTML 태그를 제거하고 순수 텍스트만 추출
        stripHtmlTags(html) {
            if (!html) return '';
            // HTML 태그 제거 및 HTML 엔티티 디코딩
            return html
                .replace(/<[^>]*>/g, '') // HTML 태그 제거
                .replace(/&nbsp;/g, ' ') // &nbsp; → 공백
                .replace(/&lt;/g, '<') // &lt; → <
                .replace(/&gt;/g, '>') // &gt; → >
                .replace(/&amp;/g, '&') // &amp; → &
                .replace(/&quot;/g, '"') // &quot; → "
                .trim();
        },
        getTaskIdFromWorkItem() {
            if (this.workItem && this.workItem.worklist) {
                return this.workItem.worklist.taskId;
            }
            return null;
        },

        getLoadingMessage() {
            const draftStatus = this.todoStatus?.draft_status;
            if (draftStatus === 'STARTED') {
                return '작업을 진행중입니다...';
            }
            if (draftStatus === 'FB_REQUESTED') {
                return '피드백을 반영하여 초안을 다시 생성하고 있습니다...';
            }
            return '';
        },

        // ========================================
        // 🔽 브라우저 에이전트 다운로드
        // ========================================
        downloadBrowserAgent() {
            // 플랫폼 감지
            const userAgent = navigator.userAgent.toLowerCase();
            const baseUrl = 'https://github.com/jhyg/browser-use-electron/releases/download/v1.0.0/';
            let downloadUrl;

            if (userAgent.includes('mac')) {
                downloadUrl = baseUrl + 'browser-use-agent.dmg';
            } else if (userAgent.includes('linux')) {
                downloadUrl = baseUrl + 'Process-GPT-App-1.0.0.AppImage';
            } else {
                downloadUrl = baseUrl + 'browser-use-agent-setup.exe';
            }

            window.open(downloadUrl, '_blank');
            localStorage.setItem('downloadedBrowserAgent', 'true');
            this.downloadedBrowserAgent = true;
        },

        // ========================================
        // ⏰ 시간 및 문자열 포맷팅
        // ========================================
        // === 출력 포맧팅 메서드들 ===
        cleanString(str) {
            return str.replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, '  ').replace(/\\\\/g, '\\');
        },

        removeFences(str) {
            return str
                .replace(/^```[a-zA-Z0-9]*\s*/, '')
                .replace(/```$/, '')
                .trim();
        },

        sanitizeOutput(output) {
            if (typeof output !== 'string') return output;
            let trimmed = output.trim();
            let loopCount = 0;
            while (loopCount < 10) {
                const beforeTrim = trimmed;
                trimmed = trimmed.replace(/^(```|~~~|""")[a-zA-Z0-9]*\s*\n([\s\S]*?)\n\1\s*$/gm, '$2').trim();
                if (beforeTrim === trimmed) break;
                loopCount++;
            }
            return trimmed;
        },

        formatOutput(output, type = 'json') {
            if (!output) return '';

            const isString = typeof output === 'string';

            if (type === 'json') {
                if (isString) {
                    const cleaned = this.cleanString(this.removeFences(output));
                    const parsed = this.parseJson(cleaned, cleaned);
                    return typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : cleaned;
                }
                return this.parseJson(output, JSON.stringify(output, null, 2));
            }

            if (type === 'markdown') {
                const sanitized = this.sanitizeOutput(output);
                const outputStr = typeof sanitized === 'object' ? JSON.stringify(sanitized, null, 2) : String(sanitized);
                const clean = this.cleanString(outputStr);
                try {
                    return marked(clean, { breaks: true, gfm: true });
                } catch {
                    return clean.replace(/\n/g, '<br>');
                }
            }

            return String(output);
        },

        // JSON을 key : value 형태의 텍스트로 변환 (중첩 객체도 펼쳐서 표시)
        convertJsonToKeyValue(data, indent = '') {
            if (!data) return '';

            let obj = data;
            if (typeof data === 'string') {
                try {
                    obj = JSON.parse(data);
                } catch (e) {
                    return data;
                }
            }

            if (typeof obj !== 'object' || Array.isArray(obj)) {
                return JSON.stringify(obj, null, 2);
            }

            const lines = [];
            Object.keys(obj).forEach((key) => {
                const value = obj[key];

                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // 중첩 객체인 경우
                    lines.push(`${indent}${key} :`);
                    Object.keys(value).forEach((subKey) => {
                        const subValue = value[subKey];
                        lines.push(`${indent}- ${subKey} : ${String(subValue)}`);
                    });
                } else {
                    // 일반 값인 경우
                    lines.push(`${indent}${key} : ${String(value)}`);
                }
            });

            return lines.join('\n');
        },

        formatJsonOutput(output) {
            const keyValueText = this.convertJsonToKeyValue(output);
            return keyValueText || this.formatOutput(output, 'json');
        },

        formatMarkdownOutput(output) {
            return this.formatOutput(output, 'markdown');
        },

        // 객체면 첫번째 키의 값을 반환, 배열/문자열 등은 그대로 반환
        resolvePrimaryValue(output, crewType) {
            const type = crewType ? String(crewType).toLowerCase() : '';
            // planning 타입: 객체(JSON 포함)이고 explanation_text 키가 있으면 그 값만 표시
            if (type === 'planning') {
                let obj = output;
                if (typeof obj === 'string') {
                    const cleaned = this.cleanString(this.removeFences(obj));
                    const parsed = this.parseJson(cleaned, null);
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                        obj = parsed;
                    }
                }
                if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                    if (Object.prototype.hasOwnProperty.call(obj, 'explanation_text')) {
                        return obj.explanation_text;
                    }
                }
                // 키가 없으면 원래 로직대로 원본 유지
                return output;
            }
            // result 타입은 원본 그대로 사용
            if (type === 'result') {
                return output;
            }
            if (output && typeof output === 'object' && !Array.isArray(output)) {
                const keys = Object.keys(output);
                if (keys.length > 0) return output[keys[0]];
            }
            return output;
        },

        // ========================================
        // 🎬 슬라이드 관리 메서드들
        // ========================================
        setSlideIndex(taskId, index) {
            const task = this.tasks.find((t) => t.id === taskId);
            if (!task) return;
            const slides = this.getSlides(task.content);
            if (index >= 0 && index < slides.length) {
                this.slideIndexes = { ...this.slideIndexes, [taskId]: index };
            }
        },

        getSlides(output) {
            if (!output) return [];
            const source = output;
            const sanitized = this.sanitizeOutput(source);
            return String(sanitized)
                .split(/^\s*---\s*$/gm)
                .filter((slide) => slide.trim())
                .map((slide) => this.formatOutput(slide.trim(), 'markdown'));
        },

        previousSlide(taskId) {
            const currentIndex = this.slideIndexes[taskId] || 0;
            if (currentIndex > 0) this.setSlideIndex(taskId, currentIndex - 1);
        },

        nextSlide(taskId) {
            const currentIndex = this.slideIndexes[taskId] || 0;
            this.setSlideIndex(taskId, currentIndex + 1);
        },

        goToSlide(taskId, index) {
            this.setSlideIndex(taskId, index);
        },

        // ========================================
        // ✅ 작업 제출 및 완료 처리
        // ========================================
        submitTask(task) {
            const original = task.outputRaw;
            // 항상 원본 객체를 우선 사용해 폼 키를 유지, 없으면 content/primary로 대체
            let payloadForSubmit = original;
            if (!payloadForSubmit || typeof payloadForSubmit !== 'object' || Array.isArray(payloadForSubmit)) {
                payloadForSubmit = task.content ?? this.resolvePrimaryValue(original, task.crewType || 'text');
            }
            let normalized = this.normalizeFormValues(payloadForSubmit);
            const hasFilePayload = this.hasFilePayload(normalized);
            if (!hasFilePayload && this.latestFormData && typeof this.latestFormData === 'object') {
                const merged = { ...(normalized || {}) };
                Object.keys(this.latestFormData).forEach((key) => {
                    const value = this.latestFormData[key];
                    if (this.isFileLikeValue(value)) {
                        merged[key] = value;
                    }
                });
                normalized = merged;
            }
            // 의도 분석 결과 감지 및 emit (work 필드가 있는 경우)
            if (normalized && normalized.work) {
                this.$emit('intent-detected', normalized);
                this.EventBus.emit('agent-intent-result', normalized);
            }

            this.EventBus.emit('form-values-updated', normalized);
        },

        /**
         * event_type 이 'human_checked' 인 이벤트를 받아서
         * 폼 HTML 업데이트에 사용할 원본 data 를 그대로 EventBus 로 전달한다.
         * 실제 HTML 변경/데이터 가공은 수신 측(예: FormWorkItem)에서 처리.
         */
        handleHumanCheckedEvent(row) {
            console.log('handleHumanCheckedEvent', row);
            if (!row || row.event_type !== 'human_checked') return;

            let payload = row.data;
            // data 가 문자열이면 JSON 파싱을 시도하고, 실패해도 그대로 사용
            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch (e) {
                    // ignore parse error, use raw string
                }
            }
            const jsonData = payload.data;
            const ambiguousValues = jsonData.ambiguous_values;
            if (ambiguousValues) {
                this.EventBus.emit('form-html-updated', ambiguousValues);
            }
        },

        normalizeFormValues(payload) {
            let obj = payload;
            if (typeof obj === 'string') {
                try {
                    obj = JSON.parse(obj);
                } catch (e) {
                    return payload;
                }
            }
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return payload;

            const result = {};
            Object.keys(obj).forEach((key) => {
                const value = obj[key];
                // 숫자만 문자열로 변환. 불리언/배열/객체는 그대로 유지
                result[key] = typeof value === 'number' ? String(value) : value;
            });
            return result;
        },

        // ========================================
        // 💾 데이터 로딩 및 상태 관리
        // ========================================
        async loadData() {
            const taskId = this.validateTaskId();
            if (!taskId) {
                this.isInitialLoading = false;
                return;
            }

            try {
                this.downloadedBrowserAgent = localStorage.getItem('downloadedBrowserAgent') === 'true';
                this.errorMessage = null;
                this.events = [];

                const { data, error } = await window.$supabase
                    .from('events')
                    .select('*')
                    .eq('todo_id', taskId)
                    .in('event_type', [
                        'task_started',
                        'task_completed',
                        'crew_completed',
                        'tool_usage_started',
                        'tool_usage_finished',
                        'human_asked',
                        'human_response',
                        'error',
                        'human_checked',
                        'task_working'
                    ])
                    .order('timestamp', { ascending: true });

                if (error) throw error;

                if (data) {
                    // timestamp가 같을 때 task_started가 task_completed보다 먼저 오도록 정렬
                    data.sort((a, b) => {
                        const timeCompare = new Date(a.timestamp) - new Date(b.timestamp);
                        if (timeCompare !== 0) return timeCompare;

                        // timestamp가 같으면 event_type으로 정렬 (task_started < task_completed)
                        if (a.event_type === 'task_started' && b.event_type === 'task_completed') return -1;
                        if (a.event_type === 'task_completed' && b.event_type === 'task_started') return 1;
                        return 0;
                    });
                    // final_report_merge가 포함된 job_id에 대한 상세 로그 (DB에서 가져온 데이터)
                    data.forEach((row) => {
                        if (row.job_id && row.job_id.includes('final_report_merge')) {
                            // console.log('[DB Load] final_report_merge 이벤트:', row);
                        }
                    });

                    // task_started 이벤트의 task_description 확인
                    data.forEach((row) => {
                        if (row.event_type === 'task_started') {
                            // console.log('[DB Load] task_started 이벤트 (초기 로드):', {
                            //     id: row.id,
                            //     job_id: row.job_id,
                            //     data: row.data,
                            //     task_description: row.data?.task_description,
                            //     goal: row.data?.goal
                            // });
                        }
                    });

                    this.events = data;
                    this.isCancelled = data.some((e) => e.event_type === 'crew_completed');
                }
            } catch (error) {
                this.handleError(error, '이벤트 데이터를 불러오는 중 오류가 발생했습니다');
            } finally {
                this.isInitialLoading = false;
            }
        },
        // ========================================
        // 📡 실시간 구독 및 이벤트 처리
        // ========================================
        setupRealtimeSubscription(taskId) {
            if (window.$mode === 'uEngine') return;
            try {
                const validEventTypes = [
                    'task_started',
                    'task_working',
                    'task_completed',
                    'crew_completed',
                    'tool_usage_started',
                    'tool_usage_finished',
                    'human_asked',
                    'human_checked',
                    'error'
                ];

                this.channel = window.$supabase
                    .channel('events')
                    .on(
                        'postgres_changes',
                        {
                            event: 'INSERT',
                            schema: 'public',
                            table: 'events'
                        },
                        ({ new: row }) => {
                            const { todo_id: todoId, event_type, job_id, id } = row;

                            if (job_id && job_id.includes('final_report_merge')) {
                                console.log('[Realtime] final_report_merge 이벤트 수신:', row);
                            }

                            const isValidEvent =
                                !this.events.some((e) => e.id === id) && validEventTypes.includes(event_type) && todoId === taskId;

                            if (isValidEvent) {
                                // === task_completed인 경우 data 없을 때 fallback 재조회 ===
                                if (event_type === 'task_completed' && (!row.data || Object.keys(row.data).length === 0)) {
                                    window.$supabase
                                        .from('events')
                                        .select('*')
                                        .eq('id', id)
                                        .single()
                                        .then(({ data: full, error }) => {
                                            console.log('[RealTime Failed] fallback DB');
                                            this.pushEventAndMaybeSubmit(!error && full ? full : row);
                                        });
                                } else {
                                    this.pushEventAndMaybeSubmit(row);
                                }

                                // 첫 이벤트 수신시 상태 동기화
                                if (!this.hasReceivedEvent) {
                                    this.hasReceivedEvent = true;
                                    if (!this.hasSyncedTodoStatusOnce) {
                                        this.hasSyncedTodoStatusOnce = true;
                                        setTimeout(async () => {
                                            await this.fetchTodoStatus();
                                            if (!this.isCancelled) {
                                                const draft = this.todoStatus?.draft_status;
                                                this.isLoading = ['STARTED', 'FB_REQUESTED'].includes(draft);
                                            }
                                        }, 300);
                                    }
                                }

                                // error 또는 crew_completed 수신 시: 로딩 해제
                                if (event_type === 'error' || event_type === 'crew_completed') {
                                    this.isLoading = false;
                                }
                            } else if (todoId !== taskId) {
                                console.warn('[ID 불일치]', { eventTodoId: todoId, currentTaskId: taskId, event: row });
                            }
                        }
                    )
                    .subscribe((status) => {
                        if (status === 'SUBSCRIPTION_ERROR') {
                            this.handleError(null, '실시간 이벤트 구독에 실패했습니다');
                        }
                    });

                // Todolist 테이블 구독 (특정 todo ID만)
                const taskId = this.getTaskIdFromWorkItem();
                if (taskId) {
                    this.todolistChannel = window.$supabase
                        .channel(`todolist-${taskId}`)
                        .on(
                            'postgres_changes',
                            {
                                event: 'UPDATE',
                                schema: 'public',
                                table: 'todolist',
                                filter: `id=eq.${taskId}`
                            },
                            ({ new: row, old: oldRow }) => {
                                // consumer 값이 변경된 경우에만 처리
                                if (row.consumer !== oldRow.consumer) {
                                    this.todoStatus = { ...this.todoStatus, ...row };

                                    // 브라우저 자동화 에이전트 iframe 처리
                                    if (row.agent_orch === 'browser-automation-agent' && row.consumer) {
                                        this.browserIframeUrl = `https://${window.$tenantName}.process-gpt.io/vnc/${row.consumer}/vnc.html`;
                                        this.showBrowserIframe = true;
                                    } else if (row.agent_orch === 'browser-automation-agent' && !row.consumer) {
                                        this.showBrowserIframe = false;
                                        this.browserIframeUrl = '';
                                    }
                                }
                            }
                        )
                        .subscribe((status) => {
                            if (status === 'SUBSCRIPTION_ERROR') {
                                this.handleError(null, '실시간 todolist 구독에 실패했습니다');
                            }
                        });
                }
            } catch (error) {
                this.handleError(error, '실시간 구독 중 오류가 발생했습니다');
            }
        },

        pushEventAndMaybeSubmit(row) {
            // 중복 방지는 isValidEvent에서 이미 처리
            this.events = [...this.events, row];

            // 사람이 결과를 검토해 준 이벤트인 경우: 폼 HTML 업데이트용 이벤트만 발생시키고 종료
            if (row.event_type === 'human_checked') {
                this.handleHumanCheckedEvent(row);
                return;
            }

            if (row.event_type !== 'task_completed') return;

            const jobId = row.job_id || row.id;

            this.$nextTick(() => {
                const task = this.tasks.find((t) => t.jobId === jobId || t.id === row.id);
                if (task && task.isCompleted) {
                    // browser-use 작업은 폼 업데이트 하지 않음
                    if (task.crewType === 'browser-use') {
                        // console.log('[AgentMonitor] browser-use 작업 완료 (폼 업데이트 스킵)', task);
                        return;
                    }

                    // console.log('[AgentMonitor] submitTask 감지', task);
                    this.submitTask(task);
                }
            });
        },

        // human_asked 응답 처리 (status 비사용: 응답 레코드만 저장)
        async onConfirmHumanQuery(task) {
            if (!task || !task.isHumanAsked) return;

            try {
                const answer = this.humanQueryAnswers[task.id] || 'confirmed';
                const base = { ...(task.eventRow || {}) };
                const newId =
                    typeof crypto !== 'undefined' && crypto.randomUUID
                        ? crypto.randomUUID()
                        : `${base.job_id || task.jobId || 'human'}-${Date.now()}`;
                const eventPayload = {
                    ...base,
                    id: newId,
                    event_type: 'human_response',
                    data: { answer },
                    status: 'APPROVED'
                };
                // 낙관적 UI 업데이트: 즉시 완료 표시 + 로그
                console.log('[HUMAN CONFIRM] sending response', eventPayload);
                this.events = [...this.events, { ...eventPayload, timestamp: new Date().toISOString() }];
                // REST upsert에는 PK(id)가 필요하므로 id를 명시적으로 생성
                await this.backend.putEvent(eventPayload);

                // 응답 후 입력값 초기화 (Vue3에서는 $delete 없음)
                delete this.humanQueryAnswers[task.id];
            } catch (error) {
                this.handleError(error, '응답 저장 중 오류가 발생했습니다');
            }
        },

        async onCancelHumanQuery(task) {
            if (!task || !task.isHumanAsked) return;

            try {
                const answer = this.humanQueryAnswers[task.id] || 'rejected';
                const base = { ...(task.eventRow || {}) };
                const newId =
                    typeof crypto !== 'undefined' && crypto.randomUUID
                        ? crypto.randomUUID()
                        : `${base.job_id || task.jobId || 'human'}-${Date.now()}`;
                const eventPayload = {
                    ...base,
                    id: newId,
                    event_type: 'human_response',
                    data: { answer },
                    status: 'REJECTED'
                };
                // 낙관적 UI 업데이트: 즉시 완료 표시 + 로그
                console.log('[HUMAN REJECT] sending response', eventPayload);
                this.events = [...this.events, { ...eventPayload, timestamp: new Date().toISOString() }];
                // REST upsert에는 PK(id)가 필요하므로 id를 명시적으로 생성
                await this.backend.putEvent(eventPayload);

                // 응답 후 입력값 초기화 (Vue3에서는 $delete 없음)
                delete this.humanQueryAnswers[task.id];
            } catch (error) {
                this.handleError(error, '응답 저장 중 오류가 발생했습니다');
            }
        },
        // status가 ASKED일 때만 모달 표시
        isHumanQueryAsked(row) {
            if (!row) return false;
            return String(row.status || '').toUpperCase() === 'ASKED';
        },
        cleanup() {
            if (this.channel) {
                window.$supabase.removeChannel(this.channel);
            }
            if (this.todolistChannel) {
                window.$supabase.removeChannel(this.todolistChannel);
            }
            this.stopEventsPolling();
        },

        // ========================================
        // 🎛️ UI 상태 관리 및 인터랙션
        // ========================================
        toggleTaskExpansion(taskId) {
            this.expandedTasks = { ...this.expandedTasks, [taskId]: !(this.expandedTasks[taskId] || false) };
        },

        // ========================================
        // 🚀 작업 실행 관련 메서드들
        // ========================================
        async startTask(newVal) {
            const taskId = this.validateTaskId();
            if (!taskId) return;

            try {
                // isLoading은 첫 이벤트 수신 후 상태 동기화 결과로 결정

                // agent_mode 처리
                const agentMode = ['DRAFT', 'COMPLETE'].includes(newVal.agentMode) ? newVal.agentMode : 'DRAFT';
                const agentOrch = this.selectedOrchestrationMethod;

                this.todoStatus = {
                    ...(this.todoStatus || {}),
                    agent_mode: agentMode,
                    status: 'IN_PROGRESS',
                    agent_orch: agentOrch
                };

                await this.backend.putWorkItem(taskId, {
                    user_id: newVal.agent || this.todoStatus.user_id,
                    agent_mode: agentMode,
                    status: 'IN_PROGRESS',
                    agent_orch: agentOrch
                });
            } catch (error) {
                this.handleError(error, '작업 시작 중 오류가 발생했습니다');
            }
        },
        async fetchTodoStatus() {
            if (window.$mode === 'uEngine') return;
            var me = this;
            const taskId = this.validateTaskId();
            if (!taskId) return;

            try {
                const { data, error } = await window.$supabase
                    .from('todolist')
                    .select('status, agent_mode, draft_status, feedback, agent_orch, consumer, draft, query')
                    .eq('id', taskId)
                    .single();

                if (error) throw error;

                this.todoStatus = data;
                if (this.isDraftBrowserUseMode) {
                    Object.values(data.draft).forEach(function draftData(draft) {
                        me.EventBus.emit('form-values-updated', draft);
                    });
                }
                this.isLoading = ['STARTED', 'FB_REQUESTED'].includes(data.draft_status);
                this.isCancelled = data.draft_status === 'CANCELLED';

                // FAILED 상태 시: 실패 알림 카드를 즉시 추가 (중복 방지)
                if (String(data.draft_status).toUpperCase() === 'FAILED') {
                    const hasAnyError = this.events.some((e) => e.event_type === 'error');
                    if (!hasAnyError) {
                        this.events = [
                            ...this.events,
                            {
                                id: `failed-${taskId}`,
                                event_type: 'error',
                                crew_type: 'text',
                                data: {
                                    message: '처리에 실패했습니다. 잠시 후 다시 시도해 주세요.',
                                    name: '시스템 오류 알림',
                                    goal: '오류 원인과 대처 안내를 전달합니다.',
                                    agent_profile: '/images/chat-icon.png'
                                },
                                timestamp: new Date().toISOString(),
                                todo_id: taskId
                            }
                        ];
                    }
                    this.isLoading = false;
                }

                // 브라우저 자동화 에이전트 iframe 초기 설정
                if (data.agent_orch === 'browser-automation-agent' && data.consumer) {
                    this.browserIframeUrl = `https://${window.$tenantName}.process-gpt.io/vnc/${data.consumer}/vnc.html`;
                    this.showBrowserIframe = true;
                } else if (data.agent_orch === 'browser-automation-agent' && !data.consumer) {
                    this.showBrowserIframe = false;
                    this.browserIframeUrl = '';
                }

                // 피드백 데이터 처리
                const feedbackArr = this.safeArrayParse(data.feedback);
                const feedbackMessages = feedbackArr
                    .map((item) => ({
                        time: item.time,
                        content: this.extractContent(item.content)
                    }))
                    .sort((a, b) => new Date(a.time) - new Date(b.time));

                // 기본적으로 피드백 메시지를 설정
                this.chatMessages = feedbackMessages;

                // isActionsMode일 때 첫 번째 요소를 workItem.description으로 "고정"하고,
                // 그 뒤에 피드백 메시지들을 이어 붙이도록 처리
                if (this.isActionsMode && this.workItem && this.workItem.worklist && this.workItem.worklist.description) {
                    const descriptionContent = this.extractContent(this.workItem.worklist.description);
                    const startDate = this.workItem.worklist.startDate || new Date().toISOString();

                    const descriptionMessage = {
                        time: startDate,
                        content: descriptionContent
                    };

                    // description을 항상 첫 번째 요소로 두고, 그 뒤에 피드백 메시지를 배치
                    this.chatMessages = [descriptionMessage, ...feedbackMessages];
                }

                // agent_orch 동기화
                const validOrchs = this.orchestrationOptions.map((o) => o.value);
                if (data.agent_orch && validOrchs.includes(data.agent_orch)) {
                    this.selectedOrchestrationMethod = data.agent_orch;
                } else if (data.agent_orch && data.agent_orch === 'a2a') {
                    this.selectedOrchestrationMethod = 'a2a';
                }
            } catch (error) {
                this.handleError(error, 'todolist 상태 조회 실패');
            }
        },
        async stopTask() {
            const taskId = this.validateTaskId();
            if (!taskId) return;

            try {
                await this.backend.putWorkItem(taskId, { draft_status: 'CANCELLED' });
                this.isCancelled = true;
                this.isLoading = false;
                if (this.todoStatus) this.todoStatus.draft_status = 'CANCELLED';
            } catch (error) {
                this.handleError(error, '작업 중단 중 오류가 발생했습니다');
            }
        },
        async submitChat(content) {
            if (!content) return;

            const taskId = this.validateTaskId();
            if (!taskId) return;

            if (this.isActionsMode) {
                if (this.todoStatus.status === 'NEW') {
                    let query = content.text;
                    if (this.todoStatus.query && this.todoStatus.query.trim() !== '') {
                        query = this.todoStatus.query + '\n\n' + content.text;
                    }
                    await this.backend.putWorkItem(taskId, {
                        status: 'IN_PROGRESS',
                        description: content.text,
                        query: query
                    });
                    this.isLoading = true;
                    this.chatMessages.push({ time: new Date().toISOString(), content: content.text });
                    this.$emit('update:new-tab-title', content.text, taskId);
                    return;
                }
            }

            try {
                const existingFeedback = this.safeArrayParse(this.todoStatus.feedback);
                const now = new Date().toISOString();
                const text = this.extractContent(content);

                const updatedFeedback = [...existingFeedback, { time: now, content: text }];
                const agentOrch = this.selectedOrchestrationMethod || this.todoStatus.agent_orch;

                let putItem = {
                    feedback: updatedFeedback,
                    agent_orch: agentOrch
                };

                if (agentOrch == 'agent') {
                    putItem['feedback_status'] = 'REQUESTED';
                }

                if (this.todoStatus.status != 'DONE') {
                    putItem['draft_status'] = 'FB_REQUESTED';
                }

                await this.backend.putWorkItem(taskId, putItem);

                // 상태 업데이트
                Object.assign(this.todoStatus, putItem);

                this.isLoading = true;
                this.chatMessages.push({ time: now, content: text });

                // 스크롤 조정
                this.$nextTick(() => {
                    const taskArea = this.$refs.taskArea;
                    if (taskArea) taskArea.scrollTop = taskArea.scrollHeight;
                });
            } catch (error) {
                this.handleError(error, '채팅 전송 중 오류가 발생했습니다');
            }
        },
        async handleUploadedFile(response) {
            if (response && response.publicUrl) {
                var me = this;
                const taskId = this.validateTaskId();
                if (!taskId) return;

                const query = me.todoStatus.query;
                const responseStr = JSON.stringify(response);
                const newQuery = query ? `${query}\n\n[InputData]\n${responseStr}` : `[InputData]\n${responseStr}`;

                await this.backend.putWorkItem(taskId, {
                    query: newQuery
                });
            }
        },
        // ========================================
        // 🎮 UI 인터랙션 및 이벤트 핸들러
        // ========================================
        toggleDropdown() {
            this.isDropdownOpen = !this.isDropdownOpen;
        },
        selectOption(value) {
            this.selectedOrchestrationMethod = value;
            this.isDropdownOpen = false;
        },
        handleOutsideClick(event) {
            const dropdown = this.$refs.dropdown;
            if (dropdown && !dropdown.contains(event.target)) {
                this.isDropdownOpen = false;
            }
        },
        // ========================================
        // 🛠️ 기타 헬퍼 메서드들
        // ========================================
        extractContent(content) {
            return typeof content === 'object' && content.text !== undefined ? content.text : content;
        },
        // ========================================
        // 🎯 오케스트레이션 방식 관련 메서드들
        // ========================================
        selectOrchestrationMethod(value) {
            this.selectedOrchestrationMethod = value.orchestration;
        },

        // ========================================
        // 🔧 Browser Dialog 메서드들
        // ========================================
        openBrowserDialog(taskId) {
            this.browserDialog = true;
        },
        closeBrowserDialog() {
            this.browserDialog = false;
        },
        handleBrowserUseCompleted(data) {
            // WorkItem 컴포넌트로 이벤트 전달
            this.$emit('browser-use-completed', data);
        },

        async updateWorkItem(newVal) {
            const oldVal = {
                agent: this.workItem.worklist.agent,
                agentMode: this.workItem.worklist.agentMode,
                orchestration: this.workItem.worklist.orchestration
            };
            let changed = false;

            // oldVal과 newVal 비교
            if (newVal) {
                if (
                    oldVal.agent !== newVal.agent ||
                    oldVal.agentMode !== newVal.agentMode ||
                    oldVal.orchestration !== newVal.orchestration
                ) {
                    changed = true;
                }
            }

            if (!changed) return;

            if (newVal && newVal.agentMode) {
                if (newVal.agentMode === 'none') return;
                if (newVal.agentMode === 'default') {
                    this.$emit('before-generate-example', null);
                    return;
                } else {
                    newVal.agentMode = newVal.agentMode.toUpperCase();
                }
            }
            this.selectedAgent = newVal;
            this.selectOrchestrationMethod(newVal);
            await this.startTask(newVal);
        }
    },
    async created() {
        try {
            this.supabase = await window.$supabase.auth.getSession();
        } catch (error) {
            console.error('Supabase 세션 오류:', error);
        }

        this.EventBus.on('formData-updated', (formData) => {
            this.latestFormData = formData;
        });

        await this.loadData();
        await this.fetchTodoStatus();
        const taskId = this.getTaskIdFromWorkItem();
        if (taskId) {
            this.setupRealtimeSubscription(taskId);
        }
    },
    async mounted() {
        // 외부 클릭 감지를 위한 이벤트 리스너 추가
        document.addEventListener('click', this.handleOutsideClick);

        if (this.workItem && this.workItem.worklist) {
            this.selectedOrchestrationMethod = this.workItem.worklist.orchestration || 'crewai-action';
        }

        if (this.selectedAgentType) {
            this.selectedAgent = this.selectedAgentType;
        }
    },
    beforeUnmount() {
        this.cleanup();
        if (this.EventBus) {
            this.EventBus.off('formData-updated');
        }
        // 이벤트 리스너 제거
        document.removeEventListener('click', this.handleOutsideClick);
    }
};
</script>

<style scoped>
.agent-monitor {
    max-width: 800px;
    margin: 0 auto;
    padding: 0 8px 8px 8px;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-sizing: border-box;
    overflow: hidden; /* 부모에서 스크롤 제거 */
}

.actions-mode {
    max-width: 100%;
    position: relative;
}

.actions-mode > .task-area {
    position: relative;
    width: 100%;
    height: 100%;
    padding: 8px;
}

.task-area {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    padding: 0;
}
.error-banner {
    background: #ffe0e0;
    color: #b71c1c;
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 16px;
    font-weight: 600;
    text-align: center;
    border: 1px solid #ffbdbd;
}

.chat-input-wrapper {
    position: relative;
    width: 100%;
    display: flex;
    flex-direction: column;
    padding: 0;
    flex-shrink: 0;
    background: white;
    border-top: 1px solid #e1e8ed;
}

/* 피드백 처리 로딩 스타일 */
.feedback-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: #f8fafb;
    border: 1px solid #e4e6ea;
    border-radius: 8px;
    margin: 12px 0 12px; /* 상단 간격 추가로 위 요소와 붙는 현상 완화 */
    font-size: 14px;
    color: #606770;
}

/* Chat 컴포넌트 숨기기 */
.chat-input-wrapper ::v-deep .chat-info-view-wrapper {
    width: 100% !important;
}
.chat-input-wrapper ::v-deep .v-avatar,
.chat-input-wrapper ::v-deep .user-name,
.chat-input-wrapper ::v-deep .chat-view-box,
.chat-input-wrapper ::v-deep .pa-4,
.chat-input-wrapper ::v-deep .v-divider {
    display: none !important;
}

.feedback-loading .stop-button {
    margin-left: auto;
    background: transparent;
    border: none;
    color: #f57c00;
    font-size: 24px;
    cursor: pointer;
}
.feedback-loading .stop-button:hover {
    text-decoration: underline;
}

/* ChatGPT 스타일 심플 드롭다운 */
.simple-dropdown {
    position: relative;
    margin-left: 8px;
    user-select: none;
}

.dropdown-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 20px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 400;
    color: #1f2937;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.dropdown-trigger:hover {
    background: #f9fafb;
    border-color: #9ca3af;
    color: #000000;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.dropdown-label {
    flex: 1;
    white-space: nowrap;
}

.dropdown-menu {
    position: absolute;
    bottom: 100%;
    left: 0;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    margin-bottom: 4px;
    min-width: 180px;
    max-width: 220px;
    padding: 4px 0;
}

.dropdown-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    cursor: pointer;
    font-size: 13px;
    color: #374151;
    transition: background-color 0.1s ease;
    margin: 0;
}
.dropdown-item:hover {
    background: #f3f4f6;
}
.dropdown-item.active {
    background: #f3f4f6;
    color: #000;
    font-weight: 500;
}

.option-left {
    display: flex;
    align-items: center;
    gap: 8px;
}
.option-icon {
    font-size: 16px;
    width: 16px;
    text-align: center;
}
.option-label {
    font-size: 13px;
}
.check-icon {
    color: #10b981;
    font-weight: 600;
    font-size: 12px;
}

/* 모바일 드롭다운 최적화 */
@media (max-width: 768px) {
    .dropdown-trigger {
        padding: 5px 10px;
        font-size: 12px;
    }
    .dropdown-menu {
        min-width: 160px;
    }
    .dropdown-item {
        padding: 6px 12px;
    }
    .option-label {
        font-size: 12px;
    }
    .option-icon {
        font-size: 14px;
    }
}

/* 브라우저 자동화 에이전트 iframe 스타일 */
.browser-iframe-container {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #f8f9fa;
}

.iframe-header {
    background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
    color: white;
    padding: 16px 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.iframe-header h3 {
    margin: 0 0 4px 0;
    font-size: 18px;
    font-weight: 600;
}

.iframe-header p {
    margin: 0;
    font-size: 14px;
    opacity: 0.9;
}

.browser-container {
    width: 100%;
    max-width: 800px;
    margin: 0 auto -800px auto; /* 하단 마진 제거 */
    position: relative;
    overflow: hidden; /* 여백 숨김 */
}

.browser-iframe {
    width: 100%;
    height: 500px; /* 높이 대폭 줄임 */
    border: none;
    background: white;
    transform: scale(0.3); /* 30% 축소 */
    transform-origin: top left;
    width: 333%; /* 축소된 만큼 너비 조정 */
    height: 1200px; /* 축소된 만큼 높이 조정 */
}

/* Browser Preview Styles */
.browser-preview {
    position: relative;
    cursor: pointer;
}

.expand-overlay {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 10;
}

.expand-btn {
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s;
}

.expand-btn:hover {
    background: rgba(0, 0, 0, 0.9);
}

/* Browser Dialog Styles */
.browser-dialog {
    height: 80vh;
}

.browser-dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    border-bottom: 1px solid #e0e0e0;
}

.close-btn {
    margin-left: auto;
}

.browser-dialog-content {
    padding: 0;
    height: calc(80vh - 80px);
    overflow: hidden;
}

.browser-dialog-iframe {
    width: 100%;
    height: 100%;
    border: none;
    background: white;
}

.empty-state {
    text-align: center;
    padding: 0px;
    background: white;
    margin-top: 12px;
    overflow: auto;
}

.empty-state .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
}

.empty-state h3 {
    font-size: 18px;
    font-weight: 600;
    color: #1d2129;
    margin: 0 0 8px 0;
}

.empty-state p {
    font-size: 14px;
    color: #606770;
    margin: 0;
}
</style>

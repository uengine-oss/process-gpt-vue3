<template>
    <div class="w-100">
        <div flat class="log-card ma-0 pa-0 w-100">
            <v-skeleton-loader v-if="isLoading" :type="isMobile ? 'card' : 'table'" class="w-100"></v-skeleton-loader>

            <v-data-table
                v-else-if="!isMobile"
                :headers="tableHeaders"
                :items="tableRows"
                v-model:page="page"
                :items-per-page="ITEMS_PER_PAGE"
                density="comfortable"
                class="log-table w-100"
                :hover="true"
                show-expand
                v-model:expanded="expandedRows"
                :item-value="(item) => item.id"
                @click:row="toggleRow"
            >
                <!-- Status Column -->
                <template #item.status="{ item }">
                    <div class="d-flex justify-center">
                        <v-tooltip v-if="item.status" location="top">
                            <template #activator="{ props }">
                                <v-icon
                                    v-bind="props"
                                    :color="getStatusColor(item.status)"
                                    :class="{ 'rotating-icon': item.status === 'PROCESSING' }"
                                >
                                    {{ getStatusIcon(item.status) }}
                                </v-icon>
                            </template>
                            <span>{{ item.status }}</span>
                        </v-tooltip>
                        <span v-else class="text-medium-emphasis text-caption">-</span>
                    </div>
                </template>

                <!-- Completed Work Column -->
                <template #item.completedWork="{ item }">
                    <div v-if="item.completedActivityName">
                        <div class="work-name">
                            <span>{{ item.completedActivityName }}</span>
                            <span v-if="item.completedRound > 1" class="pg-hist-round" data-testid="activity-round">{{
                                $t('ProcessInstanceTable.round', { n: item.completedRound })
                            }}</span>
                        </div>
                        <div v-if="item.performer" class="work-performer">
                            <v-avatar size="16" class="mr-1">
                                <v-img v-if="item.performerProfile" :src="item.performerProfile" alt="profile" />
                                <v-icon v-else size="x-small">mdi-account</v-icon>
                            </v-avatar>
                            <span>{{ item.performer }}</span>
                        </div>
                    </div>
                    <div v-else class="text-medium-emphasis text-caption">-</div>
                </template>

                <!-- Next Work Column -->
                <template #item.nextWork="{ item }">
                    <div v-if="item.nextActivityName" :class="{ 'pg-hist-current': item.current }">
                        <div class="work-name">
                            <span>{{ item.nextActivityName }}</span>
                            <span v-if="item.nextRound > 1" class="pg-hist-round" data-testid="activity-round">{{
                                $t('ProcessInstanceTable.round', { n: item.nextRound })
                            }}</span>
                            <v-chip
                                v-if="item.current"
                                size="x-small"
                                color="primary"
                                variant="flat"
                                class="pg-hist-chip"
                                data-testid="activity-current"
                                >{{ $t('ProcessInstanceTable.current') }}</v-chip
                            >
                        </div>
                        <div
                            v-if="item.loop"
                            class="pg-hist-loop"
                            data-testid="activity-loop"
                            :title="item.loop.label ? $t('ProcessInstanceTable.loopBackHint') : $t('ProcessInstanceTable.rerunHint')"
                        >
                            <v-icon size="14">{{ item.loop.label ? 'mdi-undo-variant' : 'mdi-refresh' }}</v-icon>
                            <!-- 좁은 칸에서는 「되돌아감 ·」 과 갈래 이름 사이에서만 줄을 바꾼다. -->
                            <span v-for="(part, pi) in loopParts(item.loop)" :key="pi" class="pg-hist-loop__part">{{ part }}</span>
                        </div>
                        <div v-if="item.nextPerformer" class="work-performer">
                            <v-avatar size="16" class="mr-1">
                                <v-img v-if="item.nextPerformerProfile" :src="item.nextPerformerProfile" alt="profile" />
                                <v-icon v-else size="x-small">mdi-account</v-icon>
                            </v-avatar>
                            <span>{{ item.nextPerformer }}</span>
                        </div>
                    </div>
                    <div v-else class="text-medium-emphasis text-caption">-</div>
                </template>

                <!-- Time Column -->
                <!-- 시간은 한 줄(「11.11 20:05」), 전체 날짜는 마우스를 올리면 보인다. -->
                <template #item.time="{ item }">
                    <span class="pg-hist-time" data-testid="activity-time" :title="item.timeFull">{{ item.timeShort }}</span>
                </template>

                <!-- Expanded Row -->
                <template #expanded-row="{ item }">
                    <tr style="overflow-y: auto;">
                        <td :colspan="tableHeaders.length + 1" class="pa-0">
                            <div class="expanded-content">
                                <!-- User Input Section -->
                                <div v-if="item.userMessage" class="user-input-section">
                                    <div class="pa-4 bg-blue-lighten-5">
                                        <div class="d-flex align-center mb-3">
                                            <v-icon size="small" color="primary" class="mr-2">mdi-account</v-icon>
                                            <span class="font-weight-bold text-body-1">{{ $t('ProcessInstanceTable.userInput') }}</span>
                                            <v-chip size="x-small" color="primary" variant="tonal" class="ml-2">
                                                {{ item.performer }}
                                            </v-chip>
                                        </div>
                                        <DynamicForm
                                            v-if="item.userMessage.htmlContent"
                                            :formHTML="item.userMessage.htmlContent"
                                            :readonly="true"
                                            :modelValue="item.userMessage.jsonContent || {}"
                                        />
                                        <div v-else class="text-medium-emphasis text-caption">
                                            {{ $t('ProcessInstanceTable.noFormContent') }}
                                        </div>

                                        <!-- Feedback for this item -->
                                        <!-- <div
                                            class="mt-2 pt-2"
                                            style="border-top: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity))"
                                        >
                                            <div v-if="!getRowFeedbackState(item.id).showInput">
                                                <div
                                                    class="d-flex align-center justify-space-between pa-2 bg-grey-lighten-4"
                                                    style="border-radius: 6px"
                                                >
                                                    <div class="d-flex align-center">
                                                        <v-icon size="small" class="mr-2">mdi-comment-question-outline</v-icon>
                                                        <span class="text-body-2 font-weight-medium">{{
                                                            $t('ProcessInstanceTable.stepFeedback')
                                                        }}</span>
                                                    </div>
                                                    <div class="d-flex" style="gap: 6px">
                                                        <v-btn
                                                            variant="tonal"
                                                            size="small"
                                                            color="success"
                                                            @click="selectRowFeedback(item, 'good')"
                                                        >
                                                            <v-icon start size="small">mdi-thumb-up</v-icon>
                                                            Good
                                                        </v-btn>
                                                        <v-btn
                                                            variant="tonal"
                                                            size="small"
                                                            color="error"
                                                            @click="selectRowFeedback(item, 'bad')"
                                                        >
                                                            <v-icon start size="small">mdi-thumb-down</v-icon>
                                                            Bad
                                                        </v-btn>
                                                    </div>
                                                </div>
                                            </div>
                                            <div v-if="getRowFeedbackState(item.id).showInput" class="mt-1">
                                                <ProcessFeedback
                                                    :lastMessage="item.systemMessage || item.userMessage"
                                                    :task="getRowFeedbackState(item.id).task"
                                                    @closeFeedback="closeRowFeedback(item)"
                                                    @applyFeedback="applyRowFeedback"
                                                />
                                            </div>
                                        </div> -->
                                    </div>
                                </div>

                                <!-- Streaming Message -->
                                <div
                                    v-if="item.streaming && (item.streamingLog || (item.systemMessage && item.systemMessage.log))"
                                    class="pa-4 bg-amber-lighten-5"
                                >
                                    <div class="d-flex align-center mb-2">
                                        <v-icon size="small" color="warning" class="mr-2 rotating-icon">mdi-loading</v-icon>
                                        <span class="font-weight-bold text-body-1">{{ $t('ProcessInstanceTable.processing') }}</span>
                                    </div>
                                    <v-card variant="tonal" color="warning" class="pa-3">
                                        <pre class="text-body-2 ma-0">{{ item.streamingLog || item.systemMessage.log }}</pre>
                                    </v-card>
                                </div>
                            </div>
                        </td>
                    </tr>
                </template>

                <template #no-data>
                    <div class="no-data-cell">
                        <v-icon size="large" color="medium-emphasis">mdi-inbox-outline</v-icon>
                        <div class="text-body-2 text-medium-emphasis mt-2">
                            {{ $t('ProcessInstanceLog.noData') }}
                        </div>
                    </div>
                </template>
            </v-data-table>

            <!-- 모바일: 카드 레이아웃 -->
            <div v-else class="process-instance-mobile-cards pa-3">
                <template v-if="tableRows.length === 0">
                    <div class="no-data-cell">
                        <v-icon size="large" color="medium-emphasis">mdi-inbox-outline</v-icon>
                        <div class="text-body-2 text-medium-emphasis mt-2">
                            {{ $t('ProcessInstanceLog.noData') }}
                        </div>
                    </div>
                </template>
                <v-card
                    v-for="item in tableRows"
                    :key="item.id"
                    variant="outlined"
                    class="process-instance-mobile-card mb-3"
                    @click="toggleRow($event, { item })"
                >
                    <v-card-text class="pa-4">
                        <div class="d-flex align-center justify-space-between mb-3">
                            <div class="d-flex align-center">
                                <v-tooltip v-if="item.status" location="top">
                                    <template #activator="{ props }">
                                        <v-icon
                                            v-bind="props"
                                            :color="getStatusColor(item.status)"
                                            :class="{ 'rotating-icon': item.status === 'PROCESSING' }"
                                            size="small"
                                            class="mr-2"
                                        >
                                            {{ getStatusIcon(item.status) }}
                                        </v-icon>
                                    </template>
                                    <span>{{ item.status }}</span>
                                </v-tooltip>
                                <span v-else class="text-medium-emphasis text-caption mr-2">-</span>
                                <span class="pg-hist-time" data-testid="activity-time" :title="item.timeFull">{{ item.timeShort }}</span>
                            </div>
                            <v-icon size="small" class="text-medium-emphasis">
                                {{ expandedRows.includes(item.id) ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
                            </v-icon>
                        </div>
                        <div class="process-instance-mobile-card-row">
                            <span class="process-instance-mobile-card-label text-caption text-medium-emphasis">{{
                                $t('ProcessInstanceTable.completedWork')
                            }}</span>
                            <div v-if="item.completedActivityName" class="work-name">
                                <span>{{ item.completedActivityName }}</span>
                                <span v-if="item.completedRound > 1" class="pg-hist-round" data-testid="activity-round">{{
                                    $t('ProcessInstanceTable.round', { n: item.completedRound })
                                }}</span>
                            </div>
                            <div v-else class="text-medium-emphasis text-caption">-</div>
                            <div v-if="item.performer" class="work-performer mt-1">
                                <v-avatar size="16" class="mr-1">
                                    <v-img v-if="item.performerProfile" :src="item.performerProfile" alt="profile" />
                                    <v-icon v-else size="x-small">mdi-account</v-icon>
                                </v-avatar>
                                <span>{{ item.performer }}</span>
                            </div>
                        </div>
                        <div class="process-instance-mobile-card-row mt-2 pt-2">
                            <span class="process-instance-mobile-card-label text-caption text-medium-emphasis">{{
                                $t('ProcessInstanceTable.nextWork')
                            }}</span>
                            <div v-if="item.nextActivityName" class="work-name" :class="{ 'pg-hist-current': item.current }">
                                <span>{{ item.nextActivityName }}</span>
                                <span v-if="item.nextRound > 1" class="pg-hist-round" data-testid="activity-round">{{
                                    $t('ProcessInstanceTable.round', { n: item.nextRound })
                                }}</span>
                                <v-chip
                                    v-if="item.current"
                                    size="x-small"
                                    color="primary"
                                    variant="flat"
                                    class="pg-hist-chip"
                                    data-testid="activity-current"
                                    >{{ $t('ProcessInstanceTable.current') }}</v-chip
                                >
                            </div>
                            <div v-else class="text-medium-emphasis text-caption">-</div>
                            <div
                                v-if="item.nextActivityName && item.loop"
                                class="pg-hist-loop"
                                data-testid="activity-loop"
                                :title="item.loop.label ? $t('ProcessInstanceTable.loopBackHint') : $t('ProcessInstanceTable.rerunHint')"
                            >
                                <v-icon size="14">{{ item.loop.label ? 'mdi-undo-variant' : 'mdi-refresh' }}</v-icon>
                                <span v-for="(part, pi) in loopParts(item.loop)" :key="pi" class="pg-hist-loop__part">{{ part }}</span>
                            </div>
                            <div v-if="item.nextPerformer" class="work-performer mt-1">
                                <v-avatar size="16" class="mr-1">
                                    <v-img v-if="item.nextPerformerProfile" :src="item.nextPerformerProfile" alt="profile" />
                                    <v-icon v-else size="x-small">mdi-account</v-icon>
                                </v-avatar>
                                <span>{{ item.nextPerformer }}</span>
                            </div>
                        </div>
                    </v-card-text>
                    <v-expand-transition>
                        <div v-if="expandedRows.includes(item.id)">
                            <v-divider></v-divider>
                            <div class="expanded-content pa-0">
                                <div v-if="item.userMessage" class="user-input-section">
                                    <div class="pa-4 bg-blue-lighten-5">
                                        <div class="d-flex align-center mb-3">
                                            <v-icon size="small" color="primary" class="mr-2">mdi-account</v-icon>
                                            <span class="font-weight-bold text-body-1">{{ $t('ProcessInstanceTable.userInput') }}</span>
                                            <v-chip size="x-small" color="primary" variant="tonal" class="ml-2">
                                                {{ item.performer }}
                                            </v-chip>
                                        </div>
                                        <DynamicForm
                                            v-if="item.userMessage.htmlContent"
                                            :formHTML="item.userMessage.htmlContent"
                                            :readonly="true"
                                            :modelValue="item.userMessage.jsonContent || {}"
                                        />
                                        <div v-else class="text-medium-emphasis text-caption">
                                            {{ $t('ProcessInstanceTable.noFormContent') }}
                                        </div>
                                        <div
                                            class="mt-2 pt-2"
                                            style="border-top: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity))"
                                        >
                                            <div v-if="!getRowFeedbackState(item.id).showInput">
                                                <div
                                                    class="d-flex align-center justify-space-between flex-wrap pa-2 bg-grey-lighten-4"
                                                    style="border-radius: 6px; gap: 8px"
                                                >
                                                    <div class="d-flex align-center">
                                                        <v-icon size="small" class="mr-2">mdi-comment-question-outline</v-icon>
                                                        <span class="text-body-2 font-weight-medium">{{
                                                            $t('ProcessInstanceTable.stepFeedback')
                                                        }}</span>
                                                    </div>
                                                    <div class="d-flex" style="gap: 6px">
                                                        <v-btn
                                                            variant="tonal"
                                                            size="small"
                                                            color="success"
                                                            @click.stop="selectRowFeedback(item, 'good')"
                                                        >
                                                            <v-icon start size="small">mdi-thumb-up</v-icon>
                                                            Good
                                                        </v-btn>
                                                        <v-btn
                                                            variant="tonal"
                                                            size="small"
                                                            color="error"
                                                            @click.stop="selectRowFeedback(item, 'bad')"
                                                        >
                                                            <v-icon start size="small">mdi-thumb-down</v-icon>
                                                            Bad
                                                        </v-btn>
                                                    </div>
                                                </div>
                                            </div>
                                            <div v-if="getRowFeedbackState(item.id).showInput" class="mt-1">
                                                <ProcessFeedback
                                                    :lastMessage="item.systemMessage || item.userMessage"
                                                    :task="getRowFeedbackState(item.id).task"
                                                    @closeFeedback="closeRowFeedback(item)"
                                                    @applyFeedback="applyRowFeedback"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div
                                    v-if="item.streaming && (item.streamingLog || (item.systemMessage && item.systemMessage.log))"
                                    class="pa-4 bg-amber-lighten-5"
                                >
                                    <div class="d-flex align-center mb-2">
                                        <v-icon size="small" color="warning" class="mr-2 rotating-icon">mdi-loading</v-icon>
                                        <span class="font-weight-bold text-body-1">{{ $t('ProcessInstanceTable.processing') }}</span>
                                    </div>
                                    <v-card variant="tonal" color="warning" class="pa-3">
                                        <pre class="text-body-2 ma-0 process-instance-mobile-pre">{{
                                            item.streamingLog || item.systemMessage.log
                                        }}</pre>
                                    </v-card>
                                </div>
                            </div>
                        </div>
                    </v-expand-transition>
                </v-card>
            </div>
        </div>
    </div>
</template>

<script>
import ChatModule from '@/components/ChatModule.vue';
import ProcessFeedback from '@/components/ui/ProcessFeedback.vue';
import DynamicForm from '@/components/designer/DynamicForm.vue';
import { annotateHistory, formatHistoryTime } from '@/shared/activityHistory';

export default {
    mixins: [ChatModule],
    name: 'ProcessInstanceLog',
    components: {
        ProcessFeedback,
        DynamicForm
    },
    props: {
        isComplete: Boolean,
        useThreadId: Boolean,
        messages: {
            type: Array,
            default: null
        },
        isCompleted: Boolean
    },
    data: () => ({
        processInstance: null,
        // 프로세스 정의(JSON) — 되돌아간 줄에 갈림길 이름(「반려인 경우」)을 붙이는 데만 쓴다.
        definition: null,
        chatRoomId: '',
        isTaskMode: false,
        isLoading: false,
        internalMessages: [],

        // streaming
        streamingText: '',
        childStreamingText: {},
        childSubscription: {},
        childTasks: [],
        subscription: null,
        runningTaskId: null,
        threadId: '',

        // feedback
        showFeedbackInput: false,
        lastMessage: null,
        lastTask: null,

        // table expansion
        expandedRows: [],

        // 표는 오래된 것부터 쌓인다. 처음 열 때는 지금 단계가 있는 쪽을 보여 준다(되돌아간 흐름이 길면 2쪽 뒤에 있다).
        page: 1,
        pageSettled: false,

        // per-row feedback
        rowFeedbackStates: {} // { rowId: { showInput: false, task: null } }
    }),
    computed: {
        ITEMS_PER_PAGE() {
            return 10;
        },
        isMobile() {
            return window.innerWidth <= 1279;
        },
        tableHeaders() {
            // 상태 · 시간은 내용 폭에 맞춘 고정 폭, 업무 두 칸이 나머지를 나눈다.
            // 업무 화면 왼쪽 칸(약 430px)에서 「상태」 머리가 두 줄, 시간이 세 줄로 접히던 것을 막는다.
            return [
                { title: this.$t('ProcessInstanceTable.status'), key: 'status', sortable: false, width: '56', align: 'center' },
                { title: this.$t('ProcessInstanceTable.completedWork'), key: 'completedWork', sortable: false, align: 'start' },
                { title: this.$t('ProcessInstanceTable.nextWork'), key: 'nextWork', sortable: false, align: 'start' },
                { title: this.$t('ProcessInstanceTable.time'), key: 'time', sortable: true, width: '92', align: 'start' },
                { title: '', key: 'data-table-expand', width: '44' }
            ];
        },
        effectiveMessages() {
            if (this.messages && this.messages.length > 0) {
                return this.messages;
            }
            return this.internalMessages;
        },
        tableRows() {
            const rows = [];
            const processedIndices = new Set();

            // Process messages in order and pair user+system messages
            for (let i = 0; i < this.effectiveMessages.length; i++) {
                if (processedIndices.has(i)) continue;

                const msg = this.effectiveMessages[i];

                // User message: look for next system message with matching activityId
                if (msg.role === 'user' && msg.activityId) {
                    let systemMessage = null;
                    let systemIndex = -1;

                    // Find the next system message with matching completedActivityId
                    for (let j = i + 1; j < this.effectiveMessages.length; j++) {
                        if (processedIndices.has(j)) continue;

                        const nextMsg = this.effectiveMessages[j];
                        if (
                            nextMsg.role === 'system' &&
                            nextMsg.jsonContent &&
                            nextMsg.jsonContent.completedActivities &&
                            nextMsg.jsonContent.completedActivities.length > 0
                        ) {
                            const completedActivityId = nextMsg.jsonContent.completedActivities[0].completedActivityId;
                            if (completedActivityId === msg.activityId) {
                                systemMessage = nextMsg;
                                systemIndex = j;
                                break;
                            }
                        }
                    }

                    // Create paired row
                    if (systemMessage) {
                        processedIndices.add(i);
                        processedIndices.add(systemIndex);

                        const completedActivity = systemMessage.jsonContent.completedActivities[0];
                        const nextActivity =
                            systemMessage.jsonContent.nextActivities && systemMessage.jsonContent.nextActivities.length > 0
                                ? systemMessage.jsonContent.nextActivities[0]
                                : null;

                        rows.push({
                            id: `${msg.uuid}-${systemMessage.uuid}`,
                            time: systemMessage.timeStamp || msg.timeStamp,
                            status: completedActivity.result,
                            completedActivityName: completedActivity.completedActivityName,
                            completedActivityId: completedActivity.completedActivityId,
                            performer: msg.name || msg.email || this.$t('ProcessInstanceLog.unknownSender'),
                            performerProfile: msg.profile || null,
                            nextActivityName: nextActivity ? nextActivity.nextActivityName : null,
                            nextActivityId: nextActivity ? nextActivity.nextActivityId : null,
                            nextPerformer: nextActivity ? nextActivity.nextUserName : null,
                            nextPerformerProfile: nextActivity ? nextActivity.nextUserProfile : null,
                            userMessage: msg,
                            systemMessage: systemMessage,
                            type: 'workflow-step'
                        });
                    } else {
                        // User message without system response yet
                        processedIndices.add(i);
                        rows.push({
                            id: msg.uuid || `${msg.timeStamp}-user`,
                            time: msg.timeStamp,
                            status: 'SUBMITTED',
                            completedActivityName: msg.activityId,
                            completedActivityId: msg.activityId,
                            performer: msg.name || msg.email || this.$t('ProcessInstanceLog.unknownSender'),
                            performerProfile: msg.profile || null,
                            nextActivityName: null,
                            nextActivityId: null,
                            nextPerformer: null,
                            nextPerformerProfile: null,
                            userMessage: msg,
                            systemMessage: null,
                            type: 'workflow-step'
                        });
                    }
                }
                // System message without preceding user message
                else if (msg.role === 'system' && msg.jsonContent && msg.jsonContent.completedActivities) {
                    processedIndices.add(i);

                    const completedActivity = msg.jsonContent.completedActivities[0];
                    const nextActivity =
                        msg.jsonContent.nextActivities && msg.jsonContent.nextActivities.length > 0
                            ? msg.jsonContent.nextActivities[0]
                            : null;

                    rows.push({
                        id: msg.uuid || `${msg.timeStamp}-system`,
                        time: msg.timeStamp,
                        status: completedActivity.result,
                        completedActivityName: completedActivity.completedActivityName,
                        completedActivityId: completedActivity.completedActivityId,
                        performer: null,
                        performerProfile: null,
                        nextActivityName: nextActivity ? nextActivity.nextActivityName : null,
                        nextActivityId: nextActivity ? nextActivity.nextActivityId : null,
                        nextPerformer: nextActivity ? nextActivity.nextUserName : null,
                        nextPerformerProfile: nextActivity ? nextActivity.nextUserProfile : null,
                        userMessage: null,
                        systemMessage: msg,
                        type: 'workflow-step'
                    });
                }
            }

            // Add streaming info to the last SUBMITTED row
            if (this.streamingText && rows.length > 0) {
                // Find the last row with SUBMITTED status
                for (let i = rows.length - 1; i >= 0; i--) {
                    if (rows[i].status === 'SUBMITTED' && rows[i].userMessage) {
                        rows[i].streamingLog = this.filteredStreamingText;
                        rows[i].streaming = true;
                        break;
                    }
                }
            }

            // Add child streaming as separate rows
            Object.keys(this.filteredChildStreamingText).forEach((key) => {
                rows.push({
                    id: `child-${key}`,
                    time: Date.now(),
                    status: 'SUBMITTED',
                    completedActivityName: this.childStreamingText[key].name,
                    completedActivityId: null,
                    performer: null,
                    performerProfile: null,
                    nextActivityName: null,
                    nextActivityId: null,
                    nextPerformer: null,
                    nextPerformerProfile: null,
                    userMessage: null,
                    systemMessage: { log: this.filteredChildStreamingText[key] },
                    type: 'streaming',
                    streaming: true
                });
            });

            rows.sort((a, b) => (a.time || 0) - (b.time || 0));

            // 회차 · 되돌아감 · 지금 단계 · 한 줄 시간(activityHistory). 흐름이 되돌아가면 같은 이름이
            // 여러 번 나와 헷갈렸다(2026-11-11 검토).
            const instance = this.processInstance;
            const notes = annotateHistory(rows, {
                definition: this.definition,
                currentActivityIds: instance ? instance.currentActivityIds || [] : undefined,
                finished: !!(instance && ['COMPLETED', 'DONE', 'CANCELLED', 'TERMINATED'].includes(instance.status)) || this.isComplete
            });
            const now = new Date();
            rows.forEach((row, i) => {
                const t = formatHistoryTime(row.time, now);
                Object.assign(row, notes[i], { timeShort: t.short, timeFull: t.full });
            });
            return rows;
        },
        filteredStreamingText() {
            if (!this.streamingText) {
                return '';
            }
            return this.streamingText
                .replace(/```json\s*/g, '')
                .replace(/```\s*/g, '')
                .trim();
        },
        filteredChildStreamingText() {
            const result = {};
            if (this.childStreamingText) {
                Object.keys(this.childStreamingText).forEach((key) => {
                    result[this.childStreamingText[key].name] = this.childStreamingText[key].log
                        .replace(/```json\s*/g, '')
                        .replace(/```\s*/g, '')
                        .trim();
                });
            }
            return result;
        }
    },
    watch: {
        tableRows(rows) {
            if (this.pageSettled || !rows || !rows.length) return;
            this.pageSettled = true;
            const at = rows.map((r) => !!r.current).lastIndexOf(true);
            if (at >= 0) this.page = Math.floor(at / this.ITEMS_PER_PAGE) + 1;
        },
        $route: {
            deep: true,
            async handler(newVal, oldVal) {
                if (!oldVal || !oldVal.params) {
                    await this.loadData();
                    return;
                }
                if (newVal.params.taskId !== oldVal.params.taskId || newVal.params.instId !== oldVal.params.instId) {
                    await this.loadData();
                }
            }
        },
        messages: {
            deep: true,
            handler() {
                this.updateLastMessageAndTask();
            }
        },
        streamingText: {
            handler(newVal) {
                if (newVal) {
                    // Find the last SUBMITTED row and expand it
                    const rows = this.tableRows;
                    for (let i = rows.length - 1; i >= 0; i--) {
                        if (rows[i].status === 'SUBMITTED' && rows[i].userMessage) {
                            if (!this.expandedRows.includes(rows[i].id)) {
                                this.expandedRows.push(rows[i].id);
                            }
                            break;
                        }
                    }
                }
            }
        }
    },
    async mounted() {
        await this.loadData();

        if (!this.isTaskMode && this.chatRoomId) {
            const worklist = await this.backend.getWorkListByInstId(this.chatRoomId);
            const workItem = worklist ? worklist.find((item) => item.task.status === 'SUBMITTED') : null;
            this.streamingText = '';
            if (workItem) {
                this.runningTaskId = workItem.taskId;
                await this.getTaskLog();
            }
        }
    },
    beforeUnmount() {
        if (this.subscription) {
            window.$supabase.removeChannel(this.subscription);
        }
        Object.values(this.childSubscription).forEach((sub) => {
            if (sub) {
                window.$supabase.removeChannel(sub);
            }
        });
    },
    methods: {
        async loadData() {
            this.isLoading = true;
            this.page = 1;
            this.pageSettled = false;
            this.internalMessages = [];
            this.processInstance = null;
            this.chatRoomId = '';
            this.streamingText = '';
            this.childStreamingText = {};

            if (this.subscription) {
                window.$supabase.removeChannel(this.subscription);
                this.subscription = null;
            }
            Object.values(this.childSubscription).forEach((sub) => {
                if (sub) {
                    window.$supabase.removeChannel(sub);
                }
            });
            this.childSubscription = {};
            this.childTasks = [];

            let id;
            if (this.$route.params.taskId) {
                const taskId = this.$route.params.taskId;
                const task = await this.backend.getTask(taskId);
                if (task) {
                    id = task.procInstId;
                    this.chatRoomId = id;
                }
                if (this.useThreadId) {
                    this.chatRoomId = taskId;
                }
                this.isTaskMode = true;
            } else if (this.$route.params.instId) {
                id = this.$route.params.instId.replace(/_DOT_/g, '.');
                this.chatRoomId = id;
                this.isTaskMode = false;
            }

            if (id) {
                const value = await this.backend.getInstance(id);
                if (value) {
                    this.processInstance = value;
                    this.loadDefinition(value);
                }
                await this.getMessages(this.chatRoomId);
            }

            if (this.useThreadId) {
                if (this.effectiveMessages.length > 0) {
                    this.threadId = this.effectiveMessages[0].threadId;
                } else {
                    this.threadId = await this.backend.createThreadId();
                }
            }
            this.isLoading = false;
        },
        /**
         * 갈림길 이름을 찾으려고 정의를 받아 둔다. 못 받아도 표는 그대로 그리고,
         * 되돌아간 줄에는 이름 없이 「다시 진행」 만 붙는다(activityHistory).
         */
        async loadDefinition(instance) {
            this.definition = null;
            if (!instance || !instance.defId || typeof this.backend.getExecutionDefinition !== 'function') return;
            try {
                const res = await this.backend.getExecutionDefinition(instance.defId);
                // 그새 다른 인스턴스로 옮겨 갔으면 버린다.
                if (this.processInstance && this.processInstance.instId === instance.instId) {
                    this.definition = (res && res.definition) || null;
                }
            } catch (e) {
                this.definition = null;
            }
        },
        /** 되돌아간 줄의 글 — [「되돌아감 ·」, 「반려인 경우」], 이름을 모르면 [「다시 진행」]. */
        loopParts(loop) {
            if (!loop) return [];
            return loop.label ? [`${this.$t('ProcessInstanceTable.loopBack')} ·`, loop.label] : [this.$t('ProcessInstanceTable.rerun')];
        },
        async getMessages(chatRoomId) {
            const messages = await this.backend.getMessages(chatRoomId);
            if (messages) {
                const allMessages = await Promise.all(
                    messages.map(async (message) => {
                        const newMessage = message.messages;

                        // System message: fetch next user name and profile
                        if (newMessage.role === 'system' && newMessage.jsonContent && newMessage.jsonContent.nextActivities) {
                            for (const activity of newMessage.jsonContent.nextActivities) {
                                if (activity.nextUserEmail) {
                                    try {
                                        const user = await this.backend.getUserById(activity.nextUserEmail);
                                        if (user) {
                                            if (user.username) {
                                                activity.nextUserName = user.username;
                                            }
                                            if (user.profile) {
                                                activity.nextUserProfile = user.profile;
                                            }
                                        }
                                    } catch (e) {
                                        console.error('Failed to get user:', e);
                                    }
                                }
                            }
                        }

                        newMessage.thread_id = message.thread_id || null;
                        newMessage.uuid = message.uuid;
                        return newMessage;
                    })
                );
                allMessages.sort((a, b) => new Date(a.timeStamp) - new Date(b.timeStamp));
                this.internalMessages = allMessages;
            }
        },
        updateLastMessageAndTask() {
            const msgs = this.effectiveMessages;
            if (!msgs || msgs.length === 0) {
                this.lastMessage = null;
                this.lastTask = null;
                return;
            }
            const systemMessages = msgs.filter((item) => item.role === 'system');
            if (systemMessages.length > 0) {
                this.lastMessage = systemMessages[systemMessages.length - 1];
            } else {
                this.lastMessage = msgs[msgs.length - 1];
            }
            if (this.chatRoomId) {
                this.getLastTask(this.chatRoomId);
            }
        },
        normalizeMessage(msg) {
            if (!msg) return '';
            if (msg.messageForUser) {
                return msg.messageForUser;
            }

            if (typeof msg.content === 'string') {
                return msg.content;
            }

            if (msg.contentType === 'html' || msg.contentType === 'markdown' || msg.contentType === 'json') {
                return msg.content;
            }

            if (msg.content) {
                try {
                    return JSON.stringify(msg.content, null, 2);
                } catch (e) {
                    return String(msg.content);
                }
            }

            if (msg.jsonContent) {
                try {
                    return JSON.stringify(msg.jsonContent, null, 2);
                } catch (e) {
                    return String(msg.jsonContent);
                }
            }

            return '';
        },
        getRoleColor(role) {
            const colorMap = {
                user: 'blue',
                system: 'green',
                assistant: 'purple',
                error: 'red'
            };
            return colorMap[role?.toLowerCase()] || 'grey';
        },
        getSenderIcon(role) {
            const iconMap = {
                user: 'mdi-account',
                system: 'mdi-cog',
                assistant: 'mdi-robot',
                error: 'mdi-alert-circle'
            };
            return iconMap[role?.toLowerCase()] || 'mdi-message';
        },
        getStatusColor(status) {
            const colorMap = {
                DONE: 'success',
                IN_PROGRESS: 'primary',
                SUBMITTED: 'info',
                PENDING: 'warning',
                ERROR: 'error'
            };
            return colorMap[status] || 'grey';
        },
        getStatusIcon(status) {
            const iconMap = {
                DONE: 'mdi-check-circle',
                IN_PROGRESS: 'mdi-progress-clock',
                SUBMITTED: 'mdi-send',
                PENDING: 'mdi-clock-outline',
                ERROR: 'mdi-alert-circle'
            };
            return iconMap[status] || 'mdi-help-circle';
        },
        async selectFeedback(type) {
            if (!this.lastMessage) return;

            if (this.lastMessage.jsonContent) {
                this.lastMessage.jsonContent.executionResult = type;
            } else {
                this.lastMessage.jsonContent = {
                    executionResult: type
                };
            }
            if (type === 'good') {
                if (this.lastTask && this.lastTask.taskId) {
                    await this.backend.saveFeedback(type, this.lastTask.taskId);
                }
            } else if (type === 'bad') {
                this.showFeedbackInput = true;
            }
        },
        async closeFeedback(taskId = null) {
            if (taskId) {
                this.runningTaskId = taskId;
                await this.getTaskLog();
            }
            this.showFeedbackInput = false;
        },
        async getLastTask(instId) {
            const worklist = await this.backend.getWorkListByInstId(instId);
            if (!this.lastMessage) {
                const msgs = this.effectiveMessages;
                if (msgs && msgs.length > 0) {
                    this.lastMessage = msgs[msgs.length - 1];
                }
            }
            if (
                this.lastMessage &&
                this.lastMessage.jsonContent &&
                this.lastMessage.jsonContent.completedActivities &&
                this.lastMessage.jsonContent.completedActivities.length > 0
            ) {
                const completedActivities = this.lastMessage.jsonContent.completedActivities;
                const completedActivityIds = completedActivities.map((item) => item.completedActivityId);
                const workItems = worklist.filter((item) => item.status === 'DONE' && completedActivityIds.includes(item.tracingTag));
                if (workItems.length > 0) {
                    const workItem = workItems.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
                    this.lastTask = workItem;
                }
            }
        },
        async getTaskLog() {
            let hasLoadedMessages = false;
            this.subscription = await this.backend.getTaskLog(this.runningTaskId, async (task) => {
                if (task.log) {
                    this.streamingText = task.log;
                    // 스트리밍이 시작될 때 최신 메시지를 한 번만 가져옴
                    if (!hasLoadedMessages) {
                        await this.getMessages(this.chatRoomId);
                        hasLoadedMessages = true;
                    }
                }
                if (task.status === 'DONE') {
                    this.streamingText = '';
                    if (this.subscription) {
                        window.$supabase.removeChannel(this.subscription);
                    }
                    this.childTasks.forEach((childTaskId) => {
                        this.removeChildTaskLog(childTaskId);
                    });
                    this.childStreamingText = {};
                    // loadData 대신 메시지만 업데이트하여 새로고침 없이 부드럽게 표시
                    await this.getMessages(this.chatRoomId);
                    hasLoadedMessages = false;
                }
                if (task.status === 'PENDING' && this.processInstance) {
                    await this.getChildTaskLog(this.processInstance.instId);
                }
            });
        },
        async getChildTaskLog(instId) {
            const rootWorklist = await this.backend.getWorkListByRootInstId(instId);
            if (rootWorklist) {
                rootWorklist.forEach(async (item) => {
                    if (item.task.status === 'SUBMITTED') {
                        const childTaskId = item.taskId;
                        if (this.childSubscription[childTaskId]) return;
                        this.childSubscription[childTaskId] = await this.backend.getTaskLog(childTaskId, async (childTask) => {
                            if (childTask.log) {
                                this.childStreamingText[childTaskId] = {
                                    name: item.task.activity_name + ':' + item.task.execution_scope,
                                    log: childTask.log
                                };
                            }
                        });
                        this.childTasks.push(childTaskId);
                    }
                });
            }
        },
        removeChildTaskLog(childTaskId) {
            this.childStreamingText[childTaskId] = '';
            if (this.childSubscription[childTaskId]) {
                window.$supabase.removeChannel(this.childSubscription[childTaskId]);
            }
            const index = this.childTasks.indexOf(childTaskId);
            if (index !== -1) {
                this.childTasks.splice(index, 1);
            }
        },
        async cancelAppliedFeedback() {
            if (this.lastMessage && this.lastMessage.jsonContent) {
                await this.backend.updateInstanceChat(this.chatRoomId, this.lastMessage, this.lastMessage.thread_id, this.lastMessage.uuid);
            }
        },
        getRowFeedbackState(rowId) {
            if (!this.rowFeedbackStates[rowId]) {
                this.rowFeedbackStates[rowId] = {
                    showInput: false,
                    task: null
                };
            }
            return this.rowFeedbackStates[rowId];
        },
        async selectRowFeedback(item, type) {
            if (!item.userMessage) {
                console.warn('No user message found for feedback');
                return;
            }

            // Get task info from workitemId
            let task = null;
            if (item.userMessage.workitemId) {
                task = await this.backend.getTask(item.userMessage.workitemId);
            }

            if (type === 'good') {
                if (task && task.id) {
                    try {
                        await this.backend.saveFeedback(type, task.id);
                    } catch (e) {
                        console.error('Failed to save feedback:', e);
                    }
                }
            } else if (type === 'bad') {
                this.rowFeedbackStates[item.id] = {
                    showInput: true,
                    task: task
                };
            }
        },
        closeRowFeedback(item) {
            this.rowFeedbackStates[item.id] = {
                showInput: false,
                task: null
            };
        },
        async applyRowFeedback(task) {
            if (!task) {
                return;
            }

            // 피드백 입력 닫기
            Object.keys(this.rowFeedbackStates).forEach((rowId) => {
                if (this.rowFeedbackStates[rowId].task && this.rowFeedbackStates[rowId].task.id === task.id) {
                    this.rowFeedbackStates[rowId].showInput = false;
                    const index = this.expandedRows.findIndex((row) => row === rowId);
                    if (index > -1) {
                        this.expandedRows.splice(index, 1);
                    }
                }
            });

            // 임시 SUBMITTED 상태의 user message 생성
            const tempMessage = {
                uuid: `temp-feedback-${task.id}-${Date.now()}`,
                role: 'user',
                activityId: task.activityId,
                timeStamp: new Date().toISOString(),
                name: this.$t('ProcessInstanceLog.system'),
                email: null,
                profile: null,
                workitemId: task.id,
                content: this.$t('ProcessFeedback.feedbackApplied'),
                jsonContent: null,
                thread_id: this.threadId || null
            };

            this.internalMessages.push(tempMessage);

            this.runningTaskId = task.id;
            await this.getTaskLog();
        },
        toggleRow(event, { item }) {
            const index = this.expandedRows.findIndex((row) => row === item.id);
            if (index > -1) {
                this.expandedRows.splice(index, 1);
            } else {
                this.expandedRows.push(item.id);
            }
        }
    }
};
</script>

<style scoped>
.log-card {
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.log-table {
    background: transparent;
}

.log-table :deep(.v-data-table__wrapper) {
    border-radius: 8px;
    overflow-x: auto;
}

/*
 * 고정 배치 — 상태 · 시간 · 펼침은 정한 폭, 업무 두 칸은 남은 폭을 반씩.
 * 자동 배치일 때는 다음 업무 칸의 표시(회차 · 되돌아감)에 폭을 빼앗겨 완료된 업무가 세 줄로 접혔다.
 */
.log-table :deep(table) {
    width: 100%;
    table-layout: fixed;
}

.log-table :deep(th),
.log-table :deep(td) {
    white-space: normal;
    word-wrap: break-word;
}

.log-table :deep(thead th) {
    font-weight: 600;
    font-size: 0.875rem;
    /* 「상태」 머리가 좁은 칸에서 「상 / 태」 두 줄로 접혔다. */
    white-space: nowrap;
}

/* 상태 칸은 아이콘 하나라 좌우 여백을 줄인다. */
.log-table :deep(th:first-child),
.log-table :deep(td:first-child),
.log-table :deep(th:last-child),
.log-table :deep(td:last-child) {
    padding-left: 8px !important;
    padding-right: 8px !important;
}

.log-table :deep(tbody td) {
    padding-left: 10px !important;
    padding-right: 10px !important;
}

.log-table :deep(tbody tr:hover) {
    background-color: rgba(var(--v-theme-primary), 0.05) !important;
}

.log-table :deep(tbody td) {
    padding-top: 16px;
    padding-bottom: 16px;
}

/* Work Info Styles */
.work-name {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 6px;
    font-weight: 500;
    font-size: 0.875rem;
    color: rgba(var(--v-theme-on-surface), 0.87);
    margin-bottom: 4px;
    word-break: keep-all;
}

/* 같은 단계의 몇 번째인가 — 작은 테두리 알약 */
.pg-hist-round {
    display: inline-flex;
    align-items: center;
    height: 18px;
    padding: 0 6px;
    border: 1px solid var(--cds-border-strong);
    border-radius: 999px;
    font-size: 11px;
    font-weight: 500;
    line-height: 1;
    color: var(--cds-text-secondary);
    white-space: nowrap;
}

.pg-hist-chip {
    font-weight: 600;
}

/* 흐름을 앞 단계로 돌려보낸 줄 */
.pg-hist-loop {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 11.5px;
    font-weight: 500;
    /* 글자는 본문 색(경고색 글자는 옅은 바탕 위에서 대비가 모자란다), 아이콘 · 바탕만 경고색. */
    color: var(--cds-text-primary);
    background: rgba(var(--v-theme-warning), 0.16);
    max-width: 100%;
    line-height: 1.5;
    flex-wrap: wrap;
    column-gap: 4px;
    row-gap: 0;
}

.pg-hist-loop__part {
    white-space: nowrap;
}

.pg-hist-loop .v-icon {
    color: rgb(var(--v-theme-warning));
}

/* 지금 단계를 가리키는 줄 — 줄 전체를 옅게 칠하고 왼쪽에 주 색 띠 */
.log-table :deep(tbody tr:has(.pg-hist-current)) {
    background-color: rgba(var(--v-theme-primary), 0.06);
}

.log-table :deep(tbody tr:has(.pg-hist-current) > td:first-child) {
    box-shadow: inset 3px 0 0 rgb(var(--v-theme-primary));
}

.pg-hist-current .work-name > span:first-child {
    color: rgb(var(--v-theme-primary));
    font-weight: 600;
}

.pg-hist-time {
    font-size: 0.75rem;
    color: var(--cds-text-secondary);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
}

.work-performer {
    display: flex;
    align-items: center;
    font-size: 0.75rem;
    color: rgba(var(--v-theme-on-surface), 0.6);
}

/* Activity Name Cell */
.activity-name-cell {
    font-weight: 500;
    font-size: 0.875rem;
    color: rgba(var(--v-theme-on-surface), 0.87);
    line-height: 1.5;
}

.user-input-section {
    border-bottom: 1px solid rgba(var(--v-theme-divider), 0.12);
}

/* No Data */
.no-data-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
}

/* Status Icon Animation */
.rotating-icon {
    animation: rotate 1s linear infinite;
}

@keyframes rotate {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}

/* 모바일 카드 레이아웃 */
.process-instance-mobile-cards {
    max-width: 100%;
}

.process-instance-mobile-card {
    cursor: pointer;
    border-radius: 8px;
}

.process-instance-mobile-card:has(.pg-hist-current) {
    border-color: rgb(var(--v-theme-primary));
    box-shadow: inset 3px 0 0 rgb(var(--v-theme-primary));
}

.process-instance-mobile-card-row {
    display: flex;
    flex-direction: column;
}

.process-instance-mobile-card-label {
    display: block;
    margin-bottom: 4px;
}

.process-instance-mobile-pre {
    white-space: pre-wrap;
    word-break: break-word;
    overflow-x: auto;
    max-width: 100%;
}
</style>

<template>
    <div class="process-team-chat">
        <div class="process-team-chat__header">
            <div class="process-team-chat__title">
                <v-icon size="18">mdi-robot-happy-outline</v-icon>
                <span>AI Chat</span>
            </div>
            <div class="process-team-chat__presence" v-if="presenceUsers.length > 0">
                <v-icon size="14" color="success">mdi-circle</v-icon>
                <span>{{ presenceUsers.length }}</span>
            </div>
        </div>

        <div ref="messageList" class="process-team-chat__messages">
            <div v-if="isLoading" class="process-team-chat__state">
                <v-progress-circular indeterminate size="22" width="2" color="primary" />
            </div>
            <div v-else-if="messages.length === 0" class="process-team-chat__empty">
                <v-icon size="30">mdi-message-text-outline</v-icon>
                <span>아직 메시지가 없습니다.</span>
            </div>
            <div
                v-for="message in messages"
                :key="message.uuid"
                class="process-team-chat__row"
                :class="{
                    'process-team-chat__row--mine': isMine(message),
                    'process-team-chat__row--system': message.role === 'system'
                }"
            >
                <div v-if="message.role === 'system'" class="process-team-chat__system-message">
                    {{ message.content }}
                </div>
                <template v-else>
                    <div v-if="!isMine(message) && !isAssistant(message)" class="process-team-chat__name">{{ message.name }}</div>
                    <v-sheet
                        class="process-team-chat__bubble"
                        :class="{
                            'process-team-chat__bubble--mine': isMine(message),
                            'process-team-chat__bubble--command': message.type === 'agent-command',
                            'process-team-chat__bubble--assistant': isAssistant(message)
                        }"
                        rounded="lg"
                    >
                        <div v-if="message.type === 'agent-command'" class="process-team-chat__command-label">
                            <v-icon size="14">mdi-robot-outline</v-icon>
                            <span>Agent</span>
                        </div>
                        <div v-else-if="isAssistant(message)" class="process-team-chat__command-label">
                            <v-icon size="14">mdi-robot-happy-outline</v-icon>
                            <span>AN Copilot</span>
                        </div>
                        <div class="process-team-chat__content">{{ message.content }}</div>

                        <!-- /partition 결과: 영역(블록) 목록 인라인 표시 (각 영역 Collapse 가능, 클릭 시 에디터 Zoom)
                             최신 카드는 livePartitions(현재 저장 상태)를 렌더 — 편집 가능하면 태스크 드래그 이동·블록명 인라인 편집 지원 -->
                        <div
                            v-if="message.type === 'agent-result' && message.payload && message.payload.kind === 'partition'"
                            class="process-team-chat__partition"
                        >
                            <div v-if="isLiveCard(message)" class="ptn-live-badge">
                                <v-icon size="12">mdi-sync</v-icon>
                                <span>현재 상태{{ canEditCard(message) ? ' · 드래그로 이동, 이름 더블클릭 편집' : '' }}</span>
                            </div>
                            <div
                                v-for="(block, bIdx) in partitionBlocksFor(message)"
                                :key="block.id || bIdx"
                                class="ptn-block"
                                :class="{
                                    'ptn-block--active': activeBlockKey === blockKey(message, block),
                                    'ptn-block--drop': isDropTarget(message, block)
                                }"
                                @dragover="onTaskDragOver($event, message, block)"
                                @dragleave="onTaskDragLeave(block)"
                                @drop="onTaskDrop($event, message, block)"
                            >
                                <div class="ptn-block__head" @click="onPartitionBlockClick(message, block)">
                                    <button
                                        type="button"
                                        class="ptn-block__chevron"
                                        @click.stop="toggleBlock(message, block)"
                                    >
                                        <v-icon size="16">{{ isBlockExpanded(message, block) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                    </button>
                                    <span class="ptn-block__dot" :style="{ background: blockColor(block, bIdx) }"></span>
                                    <input
                                        v-if="isRenaming(message, block)"
                                        v-model="renameDraft"
                                        class="ptn-block__rename-input"
                                        @click.stop
                                        @keydown.enter.prevent="commitRename(block)"
                                        @keydown.esc.stop.prevent="cancelRename"
                                        @blur="commitRename(block)"
                                    />
                                    <span v-else class="ptn-block__name" @dblclick.stop="startRename(message, block)">{{
                                        block.name || 'Block ' + (bIdx + 1)
                                    }}</span>
                                    <button
                                        v-if="canEditCard(message) && !isRenaming(message, block)"
                                        type="button"
                                        class="ptn-block__edit"
                                        title="블록명 편집"
                                        @click.stop="startRename(message, block)"
                                    >
                                        <v-icon size="13">mdi-pencil-outline</v-icon>
                                    </button>
                                    <span v-if="block.etom_process_id" class="ptn-block__etom">{{ block.etom_process_id }}</span>
                                    <span
                                        v-if="blockEtomCandidates(block).length > 1"
                                        class="ptn-block__etom-more"
                                        title="추가 eTOM L3 후보 — 펼쳐서 확인"
                                    >+{{ blockEtomCandidates(block).length - 1 }}</span>
                                    <v-spacer />
                                    <span class="ptn-block__count">{{ (block.tasks || []).length }}</span>
                                    <v-icon size="15" class="ptn-block__locate">mdi-crosshairs-gps</v-icon>
                                </div>
                                <div v-if="isBlockExpanded(message, block)" class="ptn-block__tasks">
                                    <div v-if="block.name_en" class="ptn-block__subtitle">{{ block.name_en }}</div>
                                    <div v-if="blockEtomCandidates(block).length" class="ptn-etom-cands">
                                        <div class="ptn-etom-cands__title">eTOM L3 후보</div>
                                        <div
                                            v-for="(cand, cIdx) in blockEtomCandidates(block)"
                                            :key="cIdx"
                                            class="ptn-etom-cand"
                                            :class="{ 'ptn-etom-cand--primary': cIdx === 0 }"
                                            :title="cand.reason || ''"
                                        >
                                            <span class="ptn-etom-cand__rank">{{ cIdx + 1 }}</span>
                                            <span v-if="cand.etom_process_id" class="ptn-etom-cand__id">{{ cand.etom_process_id }}</span>
                                            <span class="ptn-etom-cand__name">{{ cand.etom_l3 }}</span>
                                            <span v-if="cIdx === 0" class="ptn-etom-cand__badge">선정</span>
                                        </div>
                                    </div>
                                    <div
                                        v-for="task in block.tasks || []"
                                        :key="task.id"
                                        class="ptn-task"
                                        :class="{
                                            'ptn-task--focus': focusedTaskKey === blockKey(message, block) + ':' + task.id,
                                            'ptn-task--draggable': canEditCard(message)
                                        }"
                                        :data-task-id="task.id"
                                        :draggable="canEditCard(message)"
                                        @dragstart="onTaskDragStart($event, message, block, task)"
                                        @dragend="onTaskDragEnd"
                                    >
                                        <v-icon size="13" class="ptn-task__icon">{{
                                            canEditCard(message) ? 'mdi-drag-vertical' : 'mdi-pulse'
                                        }}</v-icon>
                                        <span class="ptn-task__name">{{ task.name }}</span>
                                        <span v-if="task.tmf" class="ptn-task__tmf">{{ task.tmf }}</span>
                                    </div>
                                    <div v-if="!(block.tasks || []).length" class="ptn-task ptn-task--empty">태스크 정보 없음</div>
                                </div>
                            </div>
                        </div>
                    </v-sheet>
                    <div class="process-team-chat__time">{{ formatTime(message.timeStamp) }}</div>
                </template>
            </div>
        </div>

        <div class="process-team-chat__input">
            <div class="process-team-chat__composer">
                <div v-if="commandSuggestions.length" class="process-team-chat__command-menu">
                    <button
                        v-for="(option, index) in commandSuggestions"
                        :key="option.command"
                        type="button"
                        class="process-team-chat__command-suggestion"
                        :class="{ 'process-team-chat__command-suggestion--active': index === activeCommandIndex }"
                        @mousedown.prevent="applyCommandSuggestion(option)"
                        @mouseenter="activeCommandIndex = index"
                    >
                        <span class="process-team-chat__command-suggestion-main">
                            <v-icon size="14">{{ option.icon }}</v-icon>
                            <span class="process-team-chat__command-name">{{ option.command }}</span>
                            <span class="process-team-chat__command-desc">{{ option.description }}</span>
                        </span>
                        <kbd v-if="index === activeCommandIndex">Tab</kbd>
                    </button>
                </div>
                <v-textarea
                    ref="draftInput"
                    v-model="draft"
                    class="process-team-chat__textarea"
                    density="compact"
                    variant="outlined"
                    rows="1"
                    max-rows="4"
                    auto-grow
                    hide-details
                    placeholder="메시지 입력 ('/' 입력 시 명령어 목록)"
                    :disabled="!roomId || isSending"
                    @keydown.enter.exact.prevent="handleEnterKey"
                    @keydown.tab="handleCommandTab"
                    @keydown.up="handleCommandNav($event, -1)"
                    @keydown.down="handleCommandNav($event, 1)"
                    @keydown.esc="dismissCommandMenu"
                />
            </div>
            <v-btn icon color="primary" variant="flat" :disabled="!canSend" :loading="isSending" @click="sendMessage">
                <v-icon size="18">mdi-send</v-icon>
            </v-btn>
        </div>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import { visibleSlashCommands } from '@/composables/anStudio/anIntentRouter';
import { partitionColor } from '@/composables/blueprint/partitionEditing';
import { formatTimeKST } from '@/utils/datetime';

const backend = BackendFactory.createBackend();
// 사용자별 노출 명령(/executable 게이트)이 있어 상수가 아닌 함수로 매번 산출한다
const getChatCommands = () => [
    {
        command: '/agent',
        description: 'Copilot 요청 — 자연어 요청을 AI Copilot 에 전달',
        icon: 'mdi-robot-outline',
        requiresAgentCommand: true
    },
    // AN 변환 슬래시 명령 — Copilot 명령 파서가 직접 처리하므로 그대로 전달된다
    ...visibleSlashCommands().map((cmd) => ({
        command: cmd.command,
        description: `${cmd.label} — ${cmd.description}`,
        icon: cmd.icon,
        requiresAgentCommand: true
    }))
];

export default {
    name: 'ProcessDefinitionTeamChat',
    emits: ['partition-block-click', 'partition-task-move', 'partition-block-rename'],
    props: {
        definitionId: {
            type: String,
            default: ''
        },
        processName: {
            type: String,
            default: ''
        },
        userInfo: {
            type: Object,
            default: () => ({})
        },
        agentCommandEnabled: {
            type: Boolean,
            default: false
        },
        agentCommandHandler: {
            type: Function,
            default: null
        },
        /** 현재 파티션 상태 — 가장 최근 partition 결과 카드만 payload 대신 이것을 렌더 (specs/011 US3) */
        livePartitions: {
            type: Array,
            default: null
        },
        /** 편집 UI(드래그·rename) 활성 여부 — 부모가 편집 권한·As-Is 모드로 계산 */
        partitionEditable: {
            type: Boolean,
            default: false
        }
    },
    data: () => ({
        draft: '',
        messages: [],
        isLoading: false,
        isSending: false,
        chatsWatchRef: null,
        presenceChannel: null,
        presenceUsers: [],
        activeCommandIndex: 0,
        commandMenuDismissed: false,
        expandedBlocks: {},
        activeBlockKey: '',
        // 파티션 카드 편집 상태 (specs/011 US3)
        dragTask: null, // { taskId, fromBlockId }
        dropBlockId: '',
        renamingKey: '',
        renameDraft: '',
        focusedTaskKey: ''
    }),
    computed: {
        roomId() {
            if (!this.definitionId) return '';
            // 채팅은 프로세스별 + 유저별로 분리한다 (개인 전용 스레드)
            const uid = this.currentUser?.id;
            if (!uid) return '';
            return `process-definition:${encodeURIComponent(this.definitionId)}:user:${encodeURIComponent(uid)}`;
        },
        roomName() {
            return this.processName || this.definitionId || 'Process Definition';
        },
        currentUser() {
            const user = this.userInfo || {};
            const fallbackName = localStorage.getItem('userName') || localStorage.getItem('email') || 'User';
            return {
                id: user.id || localStorage.getItem('uid') || user.email || fallbackName,
                name: user.name || user.username || fallbackName,
                email: user.email || localStorage.getItem('email') || ''
            };
        },
        canSend() {
            return !!this.roomId && this.draft.trim().length > 0 && !this.isSending;
        },
        commandSuggestions() {
            return this.getCommandSuggestions(this.draft);
        },
        /** 가장 최근 /partition 결과 카드의 uuid — 이 카드만 livePartitions 로 렌더한다 */
        latestPartitionUuid() {
            for (let i = this.messages.length - 1; i >= 0; i--) {
                const m = this.messages[i];
                if (m?.type === 'agent-result' && m.payload?.kind === 'partition') return m.uuid;
            }
            return '';
        }
    },
    watch: {
        roomId: {
            immediate: true,
            async handler() {
                await this.resetRoom();
            }
        },
        draft() {
            this.commandMenuDismissed = false;
            if (this.activeCommandIndex >= this.commandSuggestions.length) {
                this.activeCommandIndex = 0;
            }
        }
    },
    beforeUnmount() {
        this.teardownRealtime();
        if (this._focusClearTimer) clearTimeout(this._focusClearTimer);
    },
    methods: {
        async resetRoom() {
            this.teardownRealtime();
            this.messages = [];
            if (!this.roomId) return;
            this.isLoading = true;
            try {
                await this.ensureRoom();
                await this.loadMessages();
                await this.subscribeMessages();
                this.setupPresence();
            } catch (error) {
                console.error('[ProcessDefinitionTeamChat] room init failed:', error);
            } finally {
                this.isLoading = false;
                this.scrollToBottom();
            }
        },
        async ensureRoom(lastMessage = null) {
            let currentRoom = null;
            try {
                currentRoom = await backend.getChatRoom(this.roomId);
            } catch (e) {
                currentRoom = null;
            }

            const participants = this.mergeParticipant(currentRoom?.participants || []);
            const room = {
                ...(currentRoom || {}),
                id: this.roomId,
                name: this.roomName,
                participants,
                message: lastMessage || currentRoom?.message || null
            };

            await backend.putObject('db://chat_rooms', room, { onConflict: 'id' });
        },
        mergeParticipant(participants) {
            const list = Array.isArray(participants) ? [...participants] : [];
            const user = this.currentUser;
            const index = list.findIndex((item) => item.email === user.email || item.id === user.id);
            const participant = {
                id: user.id,
                username: user.name,
                email: user.email
            };
            if (index >= 0) {
                list.splice(index, 1, { ...list[index], ...participant });
            } else {
                list.push(participant);
            }
            return list;
        },
        async loadMessages() {
            const rows = await backend.getMessages(this.roomId, {
                size: 200,
                sort: 'asc',
                orderBy: `messages->>timeStamp`
            });
            this.messages = (rows || [])
                .map((row) => this.normalizeRow(row))
                .filter(Boolean)
                .sort((a, b) => new Date(a.timeStamp).getTime() - new Date(b.timeStamp).getTime());
        },
        async subscribeMessages() {
            this.chatsWatchRef = await backend.watchChats((payload) => this.handleRealtimeMessage(payload), {
                channel: `process-definition-chat-${this.roomId}`,
                filter: `id=eq.${this.roomId}`
            });
        },
        setupPresence() {
            if (!window.$supabase || !this.roomId) return;
            try {
                const channel = window.$supabase.channel(`process-definition-presence-${this.roomId}`, {
                    config: {
                        presence: {
                            key: this.currentUser.id
                        }
                    }
                });

                channel.on('presence', { event: 'sync' }, () => {
                    const state = channel.presenceState();
                    this.presenceUsers = Object.values(state)
                        .flat()
                        .map((item) => item.user)
                        .filter(Boolean);
                });

                channel.subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        await channel.track({
                            user: this.currentUser,
                            onlineAt: new Date().toISOString()
                        });
                    }
                });

                this.presenceChannel = channel;
            } catch (error) {
                console.warn('[ProcessDefinitionTeamChat] presence unavailable:', error);
            }
        },
        teardownRealtime() {
            try {
                if (this.chatsWatchRef && typeof this.chatsWatchRef.unsubscribe === 'function') {
                    this.chatsWatchRef.unsubscribe();
                }
            } catch (error) {
                console.warn('[ProcessDefinitionTeamChat] chat unsubscribe failed:', error);
            }
            this.chatsWatchRef = null;

            try {
                if (this.presenceChannel) {
                    if (window.$supabase && typeof window.$supabase.removeChannel === 'function') {
                        window.$supabase.removeChannel(this.presenceChannel);
                    } else if (typeof this.presenceChannel.unsubscribe === 'function') {
                        this.presenceChannel.unsubscribe();
                    }
                }
            } catch (error) {
                console.warn('[ProcessDefinitionTeamChat] presence unsubscribe failed:', error);
            }
            this.presenceChannel = null;
            this.presenceUsers = [];
        },
        handleRealtimeMessage(payload) {
            if (!payload) return;
            if (payload.eventType === 'DELETE') {
                const uuid = payload.old?.uuid;
                this.messages = this.messages.filter((message) => message.uuid !== uuid);
                return;
            }

            const message = this.normalizeRow(payload.new);
            if (!message) return;
            this.upsertMessage(message);
            this.scrollToBottom();
        },
        normalizeRow(row) {
            if (!row || row.id !== this.roomId) return null;
            const message = row.messages || {};
            if (!message.uuid) message.uuid = row.uuid;
            return message;
        },
        upsertMessage(message) {
            const index = this.messages.findIndex((item) => item.uuid === message.uuid);
            if (index >= 0) {
                this.messages.splice(index, 1, { ...this.messages[index], ...message });
            } else {
                this.messages.push(message);
            }
            this.messages.sort((a, b) => new Date(a.timeStamp).getTime() - new Date(b.timeStamp).getTime());
        },
        async sendMessage() {
            const content = this.draft.trim();
            if (!content || this.isSending) return;

            this.draft = '';
            this.isSending = true;
            const isCommand = this.isAgentCommand(content);
            const message = this.createMessage(content, isCommand ? 'agent-command' : 'message');

            try {
                await this.saveMessage(message);
                this.upsertMessage(message);
                this.scrollToBottom();

                if (isCommand) {
                    await this.runAgentCommand(message);
                }
            } catch (error) {
                console.error('[ProcessDefinitionTeamChat] send failed:', error);
                this.draft = content;
            } finally {
                this.isSending = false;
            }
        },
        createMessage(content, type = 'message', role = 'user', extra = {}) {
            const user = this.currentUser;
            const identity =
                role === 'system'
                    ? { name: 'System', email: 'system@uengine.org' }
                    : role === 'assistant'
                      ? { name: 'AN Copilot', email: 'copilot@uengine.org' }
                      : { name: user.name, email: user.email };
            return {
                uuid: this.uuid(),
                role,
                type,
                name: identity.name,
                email: identity.email,
                content,
                timeStamp: new Date().toISOString(),
                ...extra
            };
        },
        async saveMessage(message) {
            await backend.putObject(`db://chats/${message.uuid}`, {
                uuid: message.uuid,
                id: this.roomId,
                messages: message
            });
            await this.ensureRoom({
                msg: message.content,
                createdAt: message.timeStamp,
                sender: message.name
            });
        },
        async runAgentCommand(message) {
            const raw = message.content.trim();
            // /agent 는 자연어 요청만 전달, AN 슬래시 명령(/partition 등)은 그대로 전달
            const commandText = /^\/agent(\s|$)/i.test(raw) ? raw.replace(/^\/agent\s*/i, '').trim() : raw;

            if (!this.agentCommandEnabled || typeof this.agentCommandHandler !== 'function') {
                await this.saveSystemMessage('Agent 명령을 실행할 권한이 없습니다.');
                return;
            }

            if (!commandText) {
                await this.saveSystemMessage('Agent에게 전달할 요청이 비어 있습니다.');
                return;
            }

            try {
                const result = await this.agentCommandHandler({
                    commandText,
                    rawText: message.content,
                    sourceMessage: message,
                    roomId: this.roomId
                });
                const answer = result?.message || 'Agent에게 요청을 전달했습니다.';
                if (result?.data?.kind === 'partition') {
                    await this.saveAssistantMessage(answer, 'agent-result', { payload: result.data });
                } else {
                    await this.saveAssistantMessage(answer, 'agent-answer');
                }
            } catch (error) {
                console.error('[ProcessDefinitionTeamChat] agent command failed:', error);
                await this.saveSystemMessage(error?.message || 'Agent 명령 처리 중 오류가 발생했습니다.');
            }
        },
        async saveSystemMessage(content) {
            const message = this.createMessage(content, 'agent-status', 'system');
            await this.saveMessage(message);
            this.upsertMessage(message);
            this.scrollToBottom();
        },
        async saveAssistantMessage(content, type = 'agent-answer', extra = {}) {
            const message = this.createMessage(content, type, 'assistant', extra);
            await this.saveMessage(message);
            this.upsertMessage(message);
            this.scrollToBottom();
        },
        getCommandSuggestions(value) {
            if (this.commandMenuDismissed) return [];
            if (!value || typeof value !== 'string') return [];

            const match = value.match(/^(\s*)(\/[^\s]*)/);
            if (!match) return [];

            const token = match[2].toLowerCase();
            const suffix = value.slice(match[1].length + match[2].length);
            const commands = getChatCommands();
            // 명령 입력이 완성되어 인자를 입력 중이면 메뉴를 닫는다
            if (suffix.startsWith(' ') && commands.some((item) => item.command === token)) return [];

            return commands.filter((item) => {
                if (item.requiresAgentCommand && !this.agentCommandEnabled) return false;
                return item.command.startsWith(token);
            }).map((item) => ({
                ...item,
                token,
                prefix: match[1],
                suffix
            }));
        },
        completeCommandFromDraft(option = null) {
            const suggestion = option || this.commandSuggestions[this.activeCommandIndex] || this.commandSuggestions[0];
            if (!suggestion) return false;

            const needsSpace = !suggestion.suffix.startsWith(' ');
            this.draft = `${suggestion.prefix}${suggestion.command}${needsSpace ? ' ' : ''}${suggestion.suffix}`;
            return true;
        },
        handleCommandTab(event) {
            if (!this.completeCommandFromDraft()) return;
            event.preventDefault();
            event.stopPropagation();
            this.focusDraftInput(event.target);
        },
        handleCommandNav(event, delta) {
            const total = this.commandSuggestions.length;
            if (total < 2) return;
            event.preventDefault();
            this.activeCommandIndex = (this.activeCommandIndex + delta + total) % total;
        },
        handleEnterKey() {
            const suggestions = this.commandSuggestions;
            const active = suggestions[this.activeCommandIndex] || suggestions[0];
            // 명령어 토큰이 미완성이면 Enter 로 자동완성, 완성 상태면 전송
            if (active && active.token !== active.command) {
                this.completeCommandFromDraft(active);
                return;
            }
            this.sendMessage();
        },
        dismissCommandMenu() {
            if (this.commandSuggestions.length) this.commandMenuDismissed = true;
        },
        applyCommandSuggestion(option) {
            if (!this.completeCommandFromDraft(option)) return;
            this.focusDraftInput();
        },
        focusDraftInput(target = null) {
            this.$nextTick(() => {
                const textarea =
                    (target?.tagName === 'TEXTAREA' ? target : null) ||
                    this.$refs.draftInput?.$el?.querySelector?.('textarea') ||
                    this.$el?.querySelector?.('.process-team-chat__textarea textarea');
                if (!textarea || typeof textarea.setSelectionRange !== 'function') return;
                const end = this.draft.length;
                textarea.focus();
                textarea.setSelectionRange(end, end);
            });
        },
        isAgentCommand(content) {
            const text = content.trim();
            if (/^\/agent(\s|$)/i.test(text)) return true;
            const head = (text.split(/\s+/)[0] || '').toLowerCase();
            return getChatCommands().some((item) => item.command === head);
        },
        isMine(message) {
            return message.email && this.currentUser.email && message.email === this.currentUser.email;
        },
        isAssistant(message) {
            return message.role === 'assistant';
        },
        // color_idx 우선(파티션 생애 불변 색), 구버전 데이터는 표시 순서 폴백
        blockColor(block, index) {
            return partitionColor(Number.isInteger(block?.color_idx) ? block.color_idx : index);
        },
        /** 최신 partition 카드인지 — 최신 카드는 payload 대신 livePartitions(현재 상태)를 렌더 */
        isLiveCard(message) {
            return !!(
                Array.isArray(this.livePartitions) &&
                this.livePartitions.length &&
                message?.uuid &&
                message.uuid === this.latestPartitionUuid
            );
        },
        partitionBlocksFor(message) {
            if (this.isLiveCard(message)) return this.livePartitions;
            return message.payload?.blocks || [];
        },
        canEditCard(message) {
            return this.partitionEditable && this.isLiveCard(message);
        },
        // --- 태스크 드래그 이동 (US3) ---
        onTaskDragStart(event, message, block, task) {
            if (!this.canEditCard(message)) {
                event.preventDefault();
                return;
            }
            this.dragTask = { taskId: task.id, fromBlockId: block.id };
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                try {
                    event.dataTransfer.setData('text/plain', task.id);
                } catch (_e) {
                    /* ignore */
                }
            }
        },
        onTaskDragEnd() {
            this.dragTask = null;
            this.dropBlockId = '';
        },
        isDropTarget(message, block) {
            return !!(this.dragTask && this.dropBlockId === block.id && this.dragTask.fromBlockId !== block.id && this.canEditCard(message));
        },
        onTaskDragOver(event, message, block) {
            if (!this.dragTask || !this.canEditCard(message) || this.dragTask.fromBlockId === block.id) return;
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
            this.dropBlockId = block.id;
        },
        onTaskDragLeave(block) {
            if (this.dropBlockId === block.id) this.dropBlockId = '';
        },
        onTaskDrop(event, message, block) {
            if (!this.dragTask || !this.canEditCard(message)) return;
            event.preventDefault();
            const { taskId, fromBlockId } = this.dragTask;
            this.dragTask = null;
            this.dropBlockId = '';
            if (fromBlockId === block.id) return;
            this.$emit('partition-task-move', { taskId, fromBlockId, toBlockId: block.id });
        },
        // --- 블록명 인라인 편집 (US3) ---
        isRenaming(message, block) {
            return this.renamingKey === this.blockKey(message, block);
        },
        startRename(message, block) {
            if (!this.canEditCard(message)) return;
            this.renamingKey = this.blockKey(message, block);
            this.renameDraft = block.name || '';
            this.$nextTick(() => this.$el?.querySelector?.('.ptn-block__rename-input')?.focus?.());
        },
        cancelRename() {
            this.renamingKey = '';
            this.renameDraft = '';
        },
        commitRename(block) {
            if (!this.renamingKey) return;
            const name = (this.renameDraft || '').trim();
            this.renamingKey = '';
            this.renameDraft = '';
            if (!name || name === block.name) return;
            this.$emit('partition-block-rename', { blockId: block.id, name });
        },
        /** 캔버스 노드 클릭/배정 → 최신 카드에서 해당 블록 펼침 + 태스크 행 하이라이트·스크롤 (부모가 ref 로 호출) */
        focusPartitionNode(payload) {
            const elementId = payload?.elementId;
            if (!elementId || !this.latestPartitionUuid) return;
            const message = this.messages.find((m) => m?.uuid === this.latestPartitionUuid);
            if (!message) return;
            const blocks = this.partitionBlocksFor(message);
            const block =
                (payload?.partitionId && blocks.find((b) => b.id === payload.partitionId)) ||
                blocks.find((b) => (b.element_ids || []).includes(elementId));
            if (!block) {
                // 미배정 해제 등 — 기존 하이라이트만 제거
                this.focusedTaskKey = '';
                return;
            }
            const key = this.blockKey(message, block);
            this.activeBlockKey = key;
            if (!this.expandedBlocks[key]) {
                this.expandedBlocks = { ...this.expandedBlocks, [key]: true };
            }
            this.focusedTaskKey = `${key}:${elementId}`;
            if (this._focusClearTimer) clearTimeout(this._focusClearTimer);
            this._focusClearTimer = setTimeout(() => {
                this.focusedTaskKey = '';
            }, 1800);
            this.$nextTick(() => {
                const escaped = window.CSS?.escape ? window.CSS.escape(elementId) : elementId;
                const row = this.$el?.querySelector?.(`.ptn-task[data-task-id="${escaped}"]`);
                row?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
            });
        },
        blockEtomCandidates(block) {
            const list = Array.isArray(block?.etom_candidates)
                ? block.etom_candidates.filter((c) => c && (c.etom_l3 || c.etom_process_id))
                : [];
            if (list.length) return list;
            // 후보 목록이 없는 구버전 결과: 대표 매핑 1건만 폴백 표시
            if (block?.etom_l3 || block?.etom_process_id) {
                return [{ etom_l3: block.etom_l3 || '', etom_process_id: block.etom_process_id || '', reason: block.reasoning || '' }];
            }
            return [];
        },
        blockKey(message, block) {
            return `${message.uuid}:${block.id}`;
        },
        isBlockExpanded(message, block) {
            return !!this.expandedBlocks[this.blockKey(message, block)];
        },
        toggleBlock(message, block) {
            const key = this.blockKey(message, block);
            this.expandedBlocks = { ...this.expandedBlocks, [key]: !this.expandedBlocks[key] };
        },
        onPartitionBlockClick(message, block) {
            const key = this.blockKey(message, block);
            this.activeBlockKey = key;
            // 선택한 블록은 펼쳐서 태스크를 보여준다
            if (!this.expandedBlocks[key]) {
                this.expandedBlocks = { ...this.expandedBlocks, [key]: true };
            }
            // 에디터에 전체 블록 박스를 그리고 해당 영역으로 Zoom 한다 (최신 카드는 현재 상태 기준)
            this.$emit('partition-block-click', {
                blocks: this.partitionBlocksFor(message),
                elementIds: Array.isArray(block.element_ids) ? block.element_ids : []
            });
        },
        formatTime(value) {
            if (!value) return '';
            return formatTimeKST(value);
        },
        scrollToBottom() {
            this.$nextTick(() => {
                const el = this.$refs.messageList;
                if (el) el.scrollTop = el.scrollHeight;
            });
        },
        uuid() {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }
            return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
        }
    }
};
</script>

<style scoped>
.process-team-chat {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: #ffffff;
}

.process-team-chat__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 44px;
    padding: 0 14px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.process-team-chat__title,
.process-team-chat__presence,
.process-team-chat__command-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.process-team-chat__title {
    font-size: 13px;
    font-weight: 700;
    color: rgba(0, 0, 0, 0.78);
}

.process-team-chat__presence {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.58);
}

.process-team-chat__messages {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 14px;
    background: #f7f9fb;
}

.process-team-chat__state,
.process-team-chat__empty {
    height: 100%;
    min-height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.process-team-chat__empty {
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
    color: rgba(0, 0, 0, 0.45);
}

.process-team-chat__row {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-bottom: 12px;
}

.process-team-chat__row--mine {
    align-items: flex-end;
}

.process-team-chat__row--system {
    align-items: center;
}

.process-team-chat__name {
    max-width: 82%;
    margin: 0 0 4px 4px;
    font-size: 12px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.58);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.process-team-chat__bubble {
    max-width: min(88%, 420px);
    padding: 9px 11px;
    border: 1px solid rgba(0, 0, 0, 0.06);
    background: #ffffff;
    color: rgba(0, 0, 0, 0.84);
}

.process-team-chat__bubble--mine {
    background: rgb(var(--v-theme-primary));
    color: #ffffff;
}

.process-team-chat__bubble--command {
    border-color: rgba(var(--v-theme-primary), 0.28);
}

.process-team-chat__command-label {
    margin-bottom: 5px;
    font-size: 11px;
    font-weight: 700;
    color: currentColor;
    opacity: 0.78;
}

.process-team-chat__bubble--assistant {
    background: #ffffff;
    border-color: rgba(var(--v-theme-primary), 0.18);
}

.process-team-chat__content {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 13px;
    line-height: 1.45;
    text-align: left;
}

.process-team-chat__partition {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.ptn-block {
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    background: #fbfcfe;
    overflow: hidden;
}

.ptn-block--active {
    border-color: rgba(var(--v-theme-primary), 0.55);
    box-shadow: 0 0 0 1px rgba(var(--v-theme-primary), 0.25);
}

/* 드래그 중 드롭 대상 블록 강조 (specs/011 US3) */
.ptn-block--drop {
    border-style: dashed;
    border-color: rgba(var(--v-theme-primary), 0.7);
    background: rgba(var(--v-theme-primary), 0.06);
}

.ptn-live-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    align-self: flex-start;
    padding: 1px 8px;
    border-radius: 999px;
    background: rgba(33, 163, 107, 0.1);
    color: #1c8a5b;
    font-size: 10.5px;
    font-weight: 700;
}

.ptn-block__edit {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 0 2px;
    border: none;
    background: transparent;
    color: rgba(0, 0, 0, 0.35);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.12s ease;
}

.ptn-block__head:hover .ptn-block__edit {
    opacity: 1;
}

.ptn-block__edit:hover {
    color: rgb(var(--v-theme-primary));
}

.ptn-block__rename-input {
    min-width: 0;
    flex: 1;
    padding: 1px 6px;
    border: 1px solid rgba(var(--v-theme-primary), 0.55);
    border-radius: 5px;
    background: #ffffff;
    font-size: 12.5px;
    font-weight: 700;
    color: rgba(0, 0, 0, 0.82);
    outline: none;
}

.ptn-block__head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    cursor: pointer;
    user-select: none;
}

.ptn-block__head:hover {
    background: rgba(var(--v-theme-primary), 0.05);
}

.ptn-block__chevron {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: transparent;
    color: rgba(0, 0, 0, 0.5);
    cursor: pointer;
}

.ptn-block__dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
}

.ptn-block__name {
    font-size: 12.5px;
    font-weight: 700;
    color: rgba(0, 0, 0, 0.82);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ptn-block__etom {
    flex-shrink: 0;
    padding: 1px 6px;
    border-radius: 6px;
    background: rgba(var(--v-theme-primary), 0.1);
    color: rgb(var(--v-theme-primary));
    font-size: 10.5px;
    font-weight: 600;
}

.ptn-block__etom-more {
    flex-shrink: 0;
    padding: 1px 5px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.06);
    color: rgba(0, 0, 0, 0.55);
    font-size: 10px;
    font-weight: 700;
}

.ptn-etom-cands {
    margin: 4px 0 6px;
    padding: 5px 8px;
    border-radius: 6px;
    background: rgba(var(--v-theme-primary), 0.04);
}

.ptn-etom-cands__title {
    margin-bottom: 3px;
    font-size: 10.5px;
    font-weight: 700;
    color: rgba(0, 0, 0, 0.5);
}

.ptn-etom-cand {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
    font-size: 11.5px;
    color: rgba(0, 0, 0, 0.6);
}

.ptn-etom-cand--primary {
    color: rgba(0, 0, 0, 0.82);
    font-weight: 600;
}

.ptn-etom-cand__rank {
    flex-shrink: 0;
    width: 15px;
    height: 15px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.07);
    color: rgba(0, 0, 0, 0.55);
    font-size: 9.5px;
    font-weight: 700;
}

.ptn-etom-cand--primary .ptn-etom-cand__rank {
    background: rgba(var(--v-theme-primary), 0.15);
    color: rgb(var(--v-theme-primary));
}

.ptn-etom-cand__id {
    flex-shrink: 0;
    padding: 0 5px;
    border-radius: 5px;
    background: rgba(var(--v-theme-primary), 0.08);
    color: rgb(var(--v-theme-primary));
    font-size: 10px;
    font-weight: 600;
}

.ptn-etom-cand__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ptn-etom-cand__badge {
    flex-shrink: 0;
    padding: 0 5px;
    border-radius: 5px;
    background: rgba(33, 163, 107, 0.12);
    color: #1c8a5b;
    font-size: 9.5px;
    font-weight: 700;
}

.ptn-block__count {
    flex-shrink: 0;
    min-width: 18px;
    text-align: center;
    padding: 0 5px;
    border-radius: 9px;
    background: rgba(0, 0, 0, 0.07);
    color: rgba(0, 0, 0, 0.55);
    font-size: 11px;
    font-weight: 700;
}

.ptn-block__locate {
    flex-shrink: 0;
    color: rgba(var(--v-theme-primary), 0.7);
}

.ptn-block__tasks {
    padding: 4px 10px 8px 26px;
    border-top: 1px dashed rgba(0, 0, 0, 0.08);
}

.ptn-block__subtitle {
    margin: 4px 0 6px;
    font-size: 11px;
    color: rgba(0, 0, 0, 0.45);
}

.ptn-task {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 0;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.72);
}

.ptn-task__icon {
    color: rgba(var(--v-theme-primary), 0.6);
    flex-shrink: 0;
}

.ptn-task__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ptn-task__tmf {
    flex-shrink: 0;
    margin-left: auto;
    padding: 0 5px;
    border: 1px solid rgba(0, 0, 0, 0.14);
    border-radius: 5px;
    font-size: 10px;
    color: rgba(0, 0, 0, 0.5);
}

.ptn-task--empty {
    color: rgba(0, 0, 0, 0.4);
    font-style: italic;
}

.ptn-task--draggable {
    cursor: grab;
}

.ptn-task--draggable:active {
    cursor: grabbing;
}

/* 캔버스 노드 클릭/배정 → 해당 태스크 행 일시 하이라이트 (양방향 동기화) */
.ptn-task--focus {
    background: rgba(var(--v-theme-primary), 0.12);
    border-radius: 6px;
    margin: 0 -6px;
    padding-left: 6px;
    padding-right: 6px;
}

.process-team-chat__time {
    margin-top: 3px;
    font-size: 11px;
    color: rgba(0, 0, 0, 0.42);
}

.process-team-chat__system-message {
    max-width: 90%;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.06);
    color: rgba(0, 0, 0, 0.58);
    font-size: 12px;
    text-align: center;
    overflow-wrap: anywhere;
}

.process-team-chat__input {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 10px 12px;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    background: #ffffff;
}

.process-team-chat__composer {
    flex: 1;
    min-width: 0;
}

.process-team-chat__command-menu {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 6px;
    padding: 4px;
    max-height: 220px;
    overflow-y: auto;
    border: 1px solid rgba(var(--v-theme-primary), 0.22);
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}

.process-team-chat__command-suggestion {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 7px 9px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: rgba(0, 0, 0, 0.74);
    cursor: pointer;
    text-align: left;
}

.process-team-chat__command-suggestion--active {
    background: rgba(var(--v-theme-primary), 0.08);
}

.process-team-chat__command-suggestion-main {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    gap: 6px;
}

.process-team-chat__command-name {
    font-size: 12px;
    font-weight: 700;
    color: rgb(var(--v-theme-primary));
}

.process-team-chat__command-desc {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.54);
}

.process-team-chat__command-suggestion kbd {
    flex-shrink: 0;
    padding: 2px 5px;
    border: 1px solid rgba(0, 0, 0, 0.14);
    border-radius: 4px;
    background: #ffffff;
    color: rgba(0, 0, 0, 0.58);
    font-size: 11px;
    line-height: 1.2;
    font-family: inherit;
}

.process-team-chat__textarea {
    flex: 1;
    min-width: 0;
}
</style>

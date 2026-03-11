<template>
    <div class="agent-message-panel">
        <div class="agent-message-panel-header">
            <v-icon size="18" color="primary" class="mr-1">mdi-robot-outline</v-icon>
            <span class="text-subtitle-2 font-weight-bold">에이전트 메시지</span>
            <v-chip size="x-small" color="primary" variant="tonal" class="ml-2">
                {{ messages.length }}
            </v-chip>
        </div>
        <v-divider />
        <perfect-scrollbar class="agent-message-panel-scroll" ref="agentScrollContainer">
            <div v-for="(message, index) in messages" :key="message.uuid || index" class="py-1 px-3 agent-message-row">
                <!-- 라우팅(에이전트 선정) 로딩 -->
                <div v-if="message && message.__routingLoading">
                    <div class="message-bubble-wrap message-bubble-wrap--other">
                        <v-sheet class="other-message rounded-md pa-0 agent-panel-bubble">
                            <div class="pa-2">
                                <pre class="text-body-1 routing-loading-text">{{ message.content || '...' }}</pre>
                            </div>
                        </v-sheet>
                    </div>
                </div>

                <!-- 자동 추천(초대) 카드 -->
                <div v-else-if="message && hasValidInviteRecommendation(message)">
                    <div class="message-bubble-wrap message-bubble-wrap--other">
                        <v-sheet class="other-message rounded-md pa-0 agent-panel-bubble">
                            <div class="pa-3 pb-2">
                                <div class="text-body-2 font-weight-bold mb-1">적절한 담당자를 초대해볼까요?</div>
                                <div
                                    v-if="(message?.__agentInviteRecommendation?.reason || '').toString().trim()"
                                    class="text-caption text-medium-emphasis mb-2"
                                    style="word-break: break-word; overflow-wrap: break-word"
                                >
                                    {{ message?.__agentInviteRecommendation?.reason }}
                                </div>

                                <div
                                    v-for="agent in message?.__agentInviteRecommendation?.recommendedAgents || []"
                                    :key="agent.id"
                                    class="d-flex align-center justify-space-between mb-2 pa-2 rounded-lg"
                                    style="gap: 10px; background: rgba(0, 0, 0, 0.03)"
                                >
                                    <div class="d-flex align-center" style="gap: 10px; min-width: 0; flex: 1; overflow: hidden">
                                        <v-avatar size="30" color="grey-lighten-3" style="flex-shrink: 0">
                                            <v-img :src="agent.profile || '/images/chat-icon.png'" cover />
                                        </v-avatar>
                                        <div style="min-width: 0; flex: 1">
                                            <div
                                                class="text-body-2 font-weight-medium"
                                                style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap"
                                            >
                                                {{ agent.username || agent.id }}
                                            </div>
                                            <div
                                                class="text-caption text-medium-emphasis"
                                                style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap"
                                            >
                                                {{ agent.role || agent.description || agent.goal || '' }}
                                            </div>
                                        </div>
                                    </div>
                                    <v-btn
                                        size="small"
                                        color="primary"
                                        rounded
                                        variant="flat"
                                        style="flex-shrink: 0"
                                        :disabled="isRecommendationInvited(message, agent.id)"
                                        @click="inviteAgentFromRecommendation(message, agent)"
                                    >
                                        {{ isRecommendationInvited(message, agent.id) ? '초대됨' : '초대' }}
                                    </v-btn>
                                </div>

                                <div class="text-caption text-medium-emphasis mt-1">
                                    초대하면 에이전트가 준비된 뒤 방금 요청을 자동으로 처리합니다.
                                </div>
                            </div>
                        </v-sheet>
                    </div>
                </div>

                <!-- AgentsChat 템플릿 -->
                <AgentsChat
                    v-else-if="message && message._template === 'agent'"
                    :message="message"
                    :agentInfo="agentInfo"
                    :totalSize="messages.length"
                    :currentIndex="index"
                />

                <!-- assistant/agent role 메시지 -->
                <div v-else>
                    <div v-if="!message.disableMsg || message.isLoading">
                        <v-row v-if="shouldDisplayAgentUserInfo(message, index)" class="ma-0 pa-0">
                            <v-row class="ma-0 pa-0 d-flex align-center mb-2">
                                <v-avatar size="28" style="margin-right: 8px">
                                    <v-img
                                        :src="getAgentProfile(message)"
                                        :alt="message.name || message.userName || message.username || message.email || 'Agent'"
                                        height="28"
                                        width="28"
                                    />
                                </v-avatar>
                                <div class="user-name">
                                    {{
                                        message.role == 'system'
                                            ? 'System'
                                            : message.name || message.userName || message.username || message.email
                                    }}
                                </div>
                            </v-row>
                        </v-row>

                        <div class="w-100 pb-3">
                            <div v-if="shouldRenderAgentMessageBubble(message)" class="message-bubble-wrap message-bubble-wrap--other">
                                <div v-if="message.isLoading" class="chat-room-loading-indicator">
                                    <template v-if="getRunningToolCall(message)">
                                        <div class="chat-room-tool-calls">
                                            <div class="chat-room-tool-call-item">
                                                <v-icon size="14" color="primary" class="mr-1">mdi-wrench</v-icon>
                                                <span class="tool-name">{{ formatToolName(getRunningToolCall(message).name) }}</span>
                                                <v-progress-circular indeterminate size="14" width="2" color="primary" class="ml-2" />
                                            </div>
                                        </div>
                                    </template>
                                    <template v-else>
                                        <v-progress-circular indeterminate size="14" width="2" color="primary" />
                                        <span class="ml-2">{{ getLoadingLabel(message) }}</span>
                                    </template>
                                </div>

                                <v-sheet v-else class="other-message rounded-md pa-0 agent-panel-bubble">
                                    <div class="pa-2">
                                        <div v-if="message.image || (message.images && message.images.length > 0)" class="mb-2">
                                            <v-sheet v-if="message.image && !message.images" class="mb-1">
                                                <img
                                                    :src="message.image"
                                                    class="rounded-md"
                                                    alt="pro"
                                                    width="250"
                                                    style="cursor: pointer"
                                                    @click="$emit('preview-image', message.image)"
                                                />
                                            </v-sheet>
                                            <div v-if="message.images && message.images.length > 0" class="d-flex flex-wrap mb-1">
                                                <v-sheet v-for="(image, imgIndex) in message.images" :key="imgIndex" class="ma-1">
                                                    <img
                                                        :src="image.url || image"
                                                        class="rounded-md"
                                                        alt="pro"
                                                        width="250"
                                                        style="cursor: pointer"
                                                        @click="$emit('preview-image', image.url || image)"
                                                    />
                                                </v-sheet>
                                            </div>
                                        </div>

                                        <div v-if="message.htmlContent" v-html="message.htmlContent" class="text-body-1"></div>
                                        <pre v-else-if="message.content" class="text-body-1" v-html="linkify(message.content)"></pre>

                                        <div
                                            v-if="
                                                message.pdf2bpmnResult &&
                                                message.pdf2bpmnResult.generatedBpmns &&
                                                message.pdf2bpmnResult.generatedBpmns.length > 0
                                            "
                                            class="pdf2bpmn-result-container mt-3"
                                        >
                                            <div class="d-flex align-center mb-2">
                                                <v-icon size="16" color="success" class="mr-1">mdi-check-circle</v-icon>
                                                <span class="text-caption font-weight-bold">
                                                    생성된 BPMN 프로세스 ({{ message.pdf2bpmnResult.generatedBpmns.length }}개)
                                                </span>
                                            </div>
                                            <div class="d-flex flex-column" style="gap: 8px">
                                                <v-card
                                                    v-for="(bpmn, bIdx) in message.pdf2bpmnResult.generatedBpmns"
                                                    :key="bIdx"
                                                    class="pa-2 pdf2bpmn-bpmn-card"
                                                    variant="outlined"
                                                    @click="$emit('preview-bpmn', bpmn)"
                                                >
                                                    <div class="d-flex align-center">
                                                        <v-icon size="18" color="primary" class="mr-2">mdi-sitemap</v-icon>
                                                        <div class="flex-grow-1">
                                                            <div class="text-body-2 font-weight-bold">
                                                                {{ bpmn.process_name || 'Unnamed Process' }}
                                                            </div>
                                                            <div class="text-caption text-medium-emphasis">ID: {{ bpmn.process_id }}</div>
                                                        </div>
                                                        <v-icon size="16" color="grey">mdi-eye</v-icon>
                                                    </div>
                                                </v-card>
                                            </div>
                                        </div>
                                    </div>
                                    <v-progress-linear
                                        v-if="index === messages.length - 1 && isAgentLoading"
                                        style="margin-top: -4px; border-radius: 0 0 10px 10px; width: 99%"
                                        indeterminate
                                        class="my-progress-linear"
                                    />
                                </v-sheet>
                                <div class="agent-panel-timestamp">
                                    <span class="chat-room-timestamp-text">
                                        {{ message.timeStamp ? formatTime(message.timeStamp) : '' }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </perfect-scrollbar>
    </div>
</template>

<script>
import AgentsChat from '@/components/ui/AgentsChat.vue';

export default {
    name: 'AgentMessagePanel',
    components: {
        AgentsChat
    },
    props: {
        messages: {
            type: Array,
            default: () => []
        },
        agentInfo: {
            type: Object,
            default: null
        },
        userInfo: {
            type: Object,
            default: null
        },
        userList: {
            type: Array,
            default: () => []
        }
    },
    emits: ['invite-agent', 'preview-image', 'preview-bpmn'],
    computed: {
        isAgentLoading() {
            if (!this.messages || this.messages.length === 0) return false;
            return this.messages.some((m) => m && m.isLoading);
        }
    },
    watch: {
        messages: {
            deep: true,
            handler() {
                this.$nextTick(() => {
                    this.scrollToBottom();
                });
            }
        }
    },
    methods: {
        scrollToBottom() {
            if (this.$refs.agentScrollContainer && this.$refs.agentScrollContainer.$el) {
                const el = this.$refs.agentScrollContainer.$el;
                el.scrollTop = el.scrollHeight;
            }
        },
        isRecommendationInvited(message, agentId) {
            try {
                const rec = message?.__agentInviteRecommendation || null;
                const invited = rec?.invited || {};
                const id = (agentId || '').toString();
                if (!id) return false;
                return !!invited?.[id];
            } catch (e) {
                return false;
            }
        },
        inviteAgentFromRecommendation(message, agent) {
            try {
                const agentId = (agent?.id || '').toString();
                if (!agentId) return;
                if (message && message.__agentInviteRecommendation) {
                    if (!message.__agentInviteRecommendation.invited) message.__agentInviteRecommendation.invited = {};
                    message.__agentInviteRecommendation.invited[agentId] = true;
                }
                this.$emit('invite-agent', { messageUuid: message?.uuid || null, agentId });
            } catch (e) {
                // ignore
            }
        },
        getAgentProfile(message) {
            if (!message) return '/images/defaultUser.png';
            if (message.role == 'system') return '/images/chat-icon.png';
            if ((message.role == 'agent' || message.role == 'assistant') && message.profile) {
                return message.profile;
            }
            if (message.agentId) {
                return message.profile ? message.profile : '/images/chat-icon.png';
            }
            if (!this.userList) return '/images/defaultUser.png';
            const list = Array.isArray(this.userList) ? this.userList : [];
            const user = message.email ? list.find((u) => u.email === message.email) : null;
            const profile = user && user.profile ? user.profile : null;
            return profile ? (profile.includes('defaultUser.png') ? '/images/defaultUser.png' : profile) : '/images/defaultUser.png';
        },
        shouldDisplayAgentUserInfo(message, index) {
            if (index === 0) return true;
            const prevMessage = this.messages[index - 1];
            if (!prevMessage) return true;
            if (message.email !== prevMessage.email) return true;
            if ((message.name || message.userName) !== (prevMessage.name || prevMessage.userName)) return true;
            const currentTime = new Date(message.timeStamp);
            const prevTime = new Date(prevMessage.timeStamp);
            if (
                currentTime.getMinutes() !== prevTime.getMinutes() ||
                currentTime.getHours() !== prevTime.getHours() ||
                currentTime.getDate() !== prevTime.getDate()
            ) {
                return true;
            }
            return false;
        },
        shouldRenderAgentMessageBubble(message) {
            try {
                // 추천 카드 메시지는 추천 대상이 없으면 일반 버블도 렌더링하지 않는다.
                if (message?.__agentInviteRecommendation) {
                    const recommendedAgents = message.__agentInviteRecommendation?.recommendedAgents;
                    if (!Array.isArray(recommendedAgents) || recommendedAgents.length === 0) return false;
                }
                const text = (message?.content ?? '').toString().trim();
                const hasText = !!text || !!message?.htmlContent || !!message?.jsonContent;
                const hasImage = !!message?.image;
                const hasImages = Array.isArray(message?.images) && message.images.length > 0;
                return hasText || hasImage || hasImages;
            } catch (e) {
                return !!message?.content;
            }
        },
        getLoadingLabel(message) {
            return message?.content || '생각 중...';
        },
        hasValidInviteRecommendation(message) {
            try {
                const recommendedAgents = message?.__agentInviteRecommendation?.recommendedAgents;
                return Array.isArray(recommendedAgents) && recommendedAgents.length > 0;
            } catch (e) {
                return false;
            }
        },
        getRunningToolCall(message) {
            try {
                const tools = Array.isArray(message?.toolCalls) ? message.toolCalls : [];
                return tools.find((t) => t?.status === 'running') || null;
            } catch (e) {
                return null;
            }
        },
        formatTime(timeStamp) {
            var date = new Date(timeStamp);
            var dateString = date.toString();
            var timeString = dateString.split(' ')[4].substring(0, 5);
            return timeString;
        },
        formatToolName(name) {
            if (!name) return '';
            const raw = name.toString();
            const key = raw.split('__').pop();
            const toolNameMap = {
                get_process_list: '프로세스 목록 조회',
                get_process_detail: '프로세스 상세 조회',
                get_form_fields: '폼 필드 조회',
                execute_process: '프로세스 실행',
                get_instance_list: '인스턴스 목록 조회',
                get_todolist: '할일 목록 조회',
                get_organization: '조직도 조회',
                start_process_consulting: '프로세스 컨설팅 시작'
            };
            return toolNameMap[key] || key;
        },
        linkify(inputText) {
            if (!inputText) return '';
            var replacedText;
            var replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
            replacedText = inputText.replace(replacePattern1, '<a href="$1" target="_blank">$1</a>');
            var replacePattern2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
            replacedText = replacedText.replace(replacePattern2, '$1<a href="http://$2" target="_blank">$2</a>');
            var replacePattern3 = /(([a-zA-Z0-9\-\_\.])+@[a-zA-Z\_]+?(\.[a-zA-Z]{2,6})+)/gim;
            replacedText = replacedText.replace(replacePattern3, '<a href="mailto:$1">$1</a>');
            return replacedText;
        }
    }
};
</script>

<style scoped>
.agent-message-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    border-left: 1px solid rgba(0, 0, 0, 0.08);
    background-color: #fafbfc;
    overflow: hidden;
}
.agent-message-panel-header {
    display: flex;
    align-items: center;
    padding: 10px 14px;
    background-color: #fff;
    flex-shrink: 0;
}
.agent-message-panel-scroll {
    flex: 1;
    padding-bottom: 40px;
    overflow-y: auto;
    overflow-x: hidden;
}
.agent-message-row {
    padding: 4px 8px;
}
.agent-panel-timestamp {
    padding: 2px 4px 0;
}
.agent-panel-timestamp .chat-room-timestamp-text {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.4);
}
.user-name {
    font-weight: bold;
    align-self: self-end;
    font-size: 13px;
}
.agent-panel-bubble {
    max-width: 100%;
    width: auto;
    word-break: break-word;
}
</style>

<style>
.agent-message-panel .chat-message-bubble {
    max-width: 100% !important;
    width: auto !important;
}
.agent-message-panel .message-bubble-wrap {
    max-width: 100%;
}
.agent-message-panel .message-bubble-wrap--other {
    max-width: 100%;
}
.agent-message-panel .other-message {
    max-width: 100%;
    word-break: break-word;
}
.agent-message-panel pre {
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: break-word;
}
</style>

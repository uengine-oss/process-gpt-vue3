<template>
    <div class="main-chat-input-container" :class="containerVariantClass">
        <!-- 예시 문구들 (메인/시스템 채팅에서만 사용) -->
        <div v-if="showExamples" class="example-prompts">
            <div
                v-for="(example, index) in examples"
                :key="index"
                class="example-chip"
                @click="selectExample(example)"
            >
                <v-icon size="16" class="mr-1">{{ example.icon }}</v-icon>
                <span>{{ example.text }}</span>
            </div>
        </div>

        <!-- 입력 필드 - Chat 컴포넌트 사용 -->
        <div class="input-wrapper">
            <Chat
                ref="inputChat"
                :workAssistantAgentMode="true"
                :inputOnly="variant === 'inline'"
                :disableChat="disableChat"
                :showStopButton="showStopButton"
                :isMobile="false"
                :userList="userList"
                :currentChatRoom="currentChatRoom"
                @sendMessage="forwardSendMessage"
                @stopMessage="$emit('stopMessage')"
                @recording-mode-change="(v) => $emit('recording-mode-change', v)"
            />
        </div>
    </div>
</template>

<script>
import Chat from '@/components/ui/Chat.vue';

export default {
    name: 'UnifiedChatInput',
    components: { Chat },
    props: {
        /**
         * - panel: 기존 메인/definition-map 스타일(파란 톤 배경 + 패딩/테두리)
         * - inline: 채팅방 내부에 "핏"하게 들어가는 미니멀 스타일
         */
        variant: {
            type: String,
            default: 'panel'
        },
        showExamples: {
            type: Boolean,
            default: false
        },
        disableChat: {
            type: Boolean,
            default: false
        },
        showStopButton: {
            type: Boolean,
            default: false
        },
        // 멘션 자동완성 및 프로필 매칭에 사용
        userList: {
            type: Array,
            default: () => []
        },
        // 멘션 후보를 현재 채팅방 참여자로 제한하기 위해 필요
        currentChatRoom: {
            type: Object,
            default: null
        }
    },
    emits: ['sendMessage', 'recording-mode-change', 'stopMessage'],
    computed: {
        containerVariantClass() {
            return this.variant === 'inline'
                ? 'main-chat-input-container--inline'
                : 'main-chat-input-container--panel';
        },
        examples() {
            return [
                {
                    icon: 'mdi-plus-circle-outline',
                    text: this.$t('mainChat.examples.createProcess'),
                    type: 'create'
                },
                {
                    icon: 'mdi-play-circle-outline',
                    text: this.$t('mainChat.examples.executeProcess'),
                    type: 'execute'
                },
                {
                    icon: 'mdi-magnify',
                    text: this.$t('mainChat.examples.checkResult'),
                    type: 'query'
                },
                {
                    icon: 'mdi-help-circle-outline',
                    text: this.$t('mainChat.examples.askQuestion'),
                    type: 'question'
                }
            ];
        }
    },
    methods: {
        // ChatRoomPage(메시지 리스트)에서 reply 클릭 시, 입력창(Chat)의 reply UI를 사용하기 위한 브릿지
        setReply(message) {
            try {
                this.$refs.inputChat?.beforeReply?.(message);
            } catch (e) {}
        },
        clearReply() {
            try {
                this.$refs.inputChat?.cancelReply?.();
            } catch (e) {}
        },
        selectExample(example) {
            if (!example) return;
            this.$emit('sendMessage', {
                text: example.text,
                timestamp: new Date().toISOString(),
                file: null,
                images: null
            });
        },
        forwardSendMessage(message) {
            if (!message || (!message.text && !message.file && (!message.images || message.images.length === 0))) return;
            this.$emit('sendMessage', {
                text: (message.text || '').trim(),
                timestamp: new Date().toISOString(),
                file: message.file || null,
                images: message.images || null,
                // reply 메타데이터 pass-through (Chat.vue -> ChatRoomPage)
                reply: message.reply || null
            });
        }
    }
};
</script>

<style scoped>
.main-chat-input-container {
    width: 100%;
    padding: 16px;
    border-radius: 16px;
    border: 1px solid #e2e8f0;
}

.main-chat-input-container--panel {
    background-color: rgba(var(--v-theme-primary), 0.1);
}

.main-chat-input-container--inline {
    padding: 0;
    border: none;
    border-radius: 0;
    background-color: transparent;
}

/* 예시 문구들 */
.example-prompts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
}

.example-chip {
    display: flex;
    align-items: center;
    padding: 8px 14px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 20px;
    font-size: 13px;
    color: #808080;
    cursor: pointer;
    white-space: nowrap;
}

.example-chip:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #808080;
}

/* 입력 필드 */
.input-wrapper {
    width: 100%;
}

@media (max-width: 768px) {
    .main-chat-input-container {
        padding: 12px;
    }

    .example-prompts {
        gap: 6px;
    }

    .example-chip {
        padding: 6px 10px;
        font-size: 12px;
    }
}
</style>


<template>
    <div class="main-chat-input-container">
        <!-- 예시 문구들 + 히스토리 버튼 -->
        <div class="example-prompts">
            <div 
                v-for="(example, index) in examples" 
                :key="index"
                class="example-chip"
                @click="selectExample(example)"
            >
                <v-icon size="16" class="mr-1">{{ example.icon }}</v-icon>
                <span>{{ example.text }}</span>
            </div>
            
            <!-- 히스토리 버튼 -->
            <v-menu 
                v-model="showHistory" 
                :close-on-content-click="false"
                location="bottom end"
            >
                <template v-slot:activator="{ props }">
                    <v-btn
                        v-bind="props"
                        icon
                        variant="text"
                        size="small"
                        class="history-btn"
                        :class="{ 'active': showHistory }"
                    >
                        <v-icon>mdi-history</v-icon>
                    </v-btn>
                </template>
                
                <!-- 히스토리 드롭다운 -->
                <v-card class="history-dropdown" min-width="280" max-width="320">
                    <v-card-title class="history-dropdown-title pa-3 pb-2">
                        <span>{{ $t('mainChat.history.title') }}</span>
                    </v-card-title>
                    <v-divider></v-divider>
                    
                    <div v-if="isLoadingHistory" class="history-loading pa-4">
                        <v-progress-circular indeterminate size="20" color="primary"></v-progress-circular>
                        <span class="ml-2">{{ $t('mainChat.history.loading') }}</span>
                    </div>
                    
                    <div v-else-if="chatHistory.length === 0" class="history-empty pa-4 text-center">
                        <v-icon size="32" color="grey-lighten-1">mdi-chat-outline</v-icon>
                        <p class="text-caption text-grey mt-2 mb-0">{{ $t('mainChat.history.empty') }}</p>
                    </div>
                    
                    <v-list v-else density="compact" class="pa-0">
                        <v-list-item
                            v-for="item in chatHistory"
                            :key="item.taskId"
                            @click="openHistoryItem(item)"
                            class="history-list-item"
                        >
                            <template v-slot:prepend>
                                <v-icon size="18" :color="getStatusColor(item.status)">
                                    {{ getStatusIcon(item.status) }}
                                </v-icon>
                            </template>
                            <v-list-item-title class="history-item-title">
                                {{ item.title }}
                            </v-list-item-title>
                            <template v-slot:append>
                                <span class="history-item-date text-caption text-grey">
                                    {{ formatDate(item.updatedAt) }}
                                </span>
                            </template>
                        </v-list-item>
                    </v-list>
                </v-card>
            </v-menu>
        </div>

        <!-- 입력 필드 -->
        <div class="input-wrapper">
            <div class="input-field-container">
                <v-icon class="input-icon" color="primary" size="20">mdi-message-text-outline</v-icon>
                <input
                    v-model="inputText"
                    type="text"
                    class="main-input"
                    :placeholder="$t('mainChat.placeholder')"
                    @keyup.enter="handleSubmit"
                    @focus="isFocused = true"
                    @blur="handleBlur"
                    ref="inputField"
                />
                <v-btn
                    icon
                    variant="text"
                    size="small"
                    color="primary"
                    :disabled="!inputText.trim()"
                    @click="handleSubmit"
                    class="send-btn"
                >
                    <v-icon>mdi-send</v-icon>
                </v-btn>
            </div>
        </div>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';

const backend = BackendFactory.createBackend();

export default {
    name: 'MainChatInput',
    props: {
        agentInfo: {
            type: Object,
            default: null
        },
        userId: {
            type: String,
            default: null
        }
    },
    data() {
        return {
            inputText: '',
            isFocused: false,
            showHistory: false,
            isLoadingHistory: false,
            chatHistory: [],
            examples: [
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
            ]
        };
    },
    computed: {
        // AgentChatActions와 동일한 instId 사용
        instId() {
            return this.agentInfo ? `${this.agentInfo.id}-actions` : null;
        }
    },
    watch: {
        showHistory(val) {
            if (val) {
                this.loadHistory();
            }
        }
    },
    methods: {
        selectExample(example) {
            this.inputText = example.text;
            this.$refs.inputField.focus();
        },
        handleSubmit() {
            if (!this.inputText.trim()) return;
            
            this.$emit('submit', {
                text: this.inputText.trim(),
                timestamp: new Date().toISOString()
            });
            
            this.inputText = '';
        },
        handleBlur() {
            this.isFocused = false;
        },
        async loadHistory() {
            if (!this.instId) return;
            
            this.isLoadingHistory = true;
            try {
                // AgentChatActions.vue의 loadExistingWorkItems와 동일한 방식
                let worklist = await backend.getWorkListByInstId(this.instId);
                if (worklist && worklist.length > 0) {
                    // 최신순 정렬
                    worklist = worklist.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                    
                    this.chatHistory = [];
                    for (const workItemRef of worklist) {
                        const workItem = await backend.getWorkItem(workItemRef.taskId);
                        if (workItem) {
                            const title = workItem.activity?.name || 
                                         workItem.worklist?.description || 
                                         workItem.worklist?.query || 
                                         '새 대화';
                            
                            this.chatHistory.push({
                                taskId: workItemRef.taskId,
                                title: title.length > 25 ? title.substring(0, 25) + '...' : title,
                                status: workItem.worklist?.status,
                                updatedAt: workItem.worklist?.updatedAt || workItemRef.updatedAt,
                                workItem: workItem
                            });
                        }
                    }
                } else {
                    this.chatHistory = [];
                }
            } catch (error) {
                console.error('히스토리 로드 오류:', error);
                this.chatHistory = [];
            } finally {
                this.isLoadingHistory = false;
            }
        },
        openHistoryItem(item) {
            this.showHistory = false;
            this.$emit('open-history', item);
        },
        getStatusIcon(status) {
            switch (status) {
                case 'COMPLETED':
                case 'DONE':
                    return 'mdi-check-circle';
                case 'IN_PROGRESS':
                    return 'mdi-progress-clock';
                case 'ERROR':
                case 'FAILED':
                    return 'mdi-alert-circle';
                default:
                    return 'mdi-message-text-outline';
            }
        },
        getStatusColor(status) {
            switch (status) {
                case 'COMPLETED':
                case 'DONE':
                    return 'success';
                case 'IN_PROGRESS':
                    return 'primary';
                case 'ERROR':
                case 'FAILED':
                    return 'error';
                default:
                    return 'grey';
            }
        },
        formatDate(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            const now = new Date();
            const diff = now - date;
            
            if (diff < 24 * 60 * 60 * 1000) {
                return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
            }
            if (diff < 7 * 24 * 60 * 60 * 1000) {
                const days = Math.floor(diff / (24 * 60 * 60 * 1000));
                return `${days}일 전`;
            }
            return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        }
    }
};
</script>

<style scoped>
.main-chat-input-container {
    width: 100%;
    padding: 16px;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    border-radius: 16px;
    border: 1px solid #e2e8f0;
}

/* 히스토리 버튼 */
.history-btn {
    margin-left: auto;
    color: #64748b;
    transition: all 0.2s ease;
}

.history-btn:hover,
.history-btn.active {
    color: rgb(var(--v-theme-primary));
    background: rgba(var(--v-theme-primary), 0.1);
}

/* 히스토리 드롭다운 */
.history-dropdown {
    max-height: 350px;
    overflow: hidden;
}

.history-dropdown-title {
    font-size: 14px;
    font-weight: 600;
    color: #1e293b;
}

.history-loading,
.history-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #64748b;
}

.history-list-item {
    cursor: pointer;
    border-bottom: 1px solid #f1f5f9;
}

.history-list-item:last-child {
    border-bottom: none;
}

.history-list-item:hover {
    background: #f8fafc;
}

.history-item-title {
    font-size: 13px;
    font-weight: 500;
    color: #1e293b;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.history-item-date {
    font-size: 11px;
    white-space: nowrap;
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
    color: #475569;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
}

.example-chip:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #1e293b;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* 입력 필드 */
.input-wrapper {
    width: 100%;
}

.input-field-container {
    display: flex;
    align-items: center;
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    padding: 4px 8px 4px 16px;
    transition: all 0.2s ease;
}

.input-field-container:focus-within {
    border-color: rgb(var(--v-theme-primary));
    box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.1);
}

.input-icon {
    flex-shrink: 0;
    margin-right: 12px;
}

.main-input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 15px;
    color: #1e293b;
    background: transparent;
    padding: 12px 0;
}

.main-input::placeholder {
    color: #94a3b8;
}

.send-btn {
    flex-shrink: 0;
    margin-left: 8px;
}

/* 모바일 반응형 */
@media (max-width: 768px) {
    .main-chat-input-container {
        padding: 12px;
    }
    
    .card-header {
        margin-bottom: 12px;
        padding-bottom: 10px;
    }
    
    .header-title {
        font-size: 14px;
    }
    
    .example-prompts {
        gap: 6px;
    }
    
    .example-chip {
        padding: 6px 10px;
        font-size: 12px;
    }
    
    .main-input {
        font-size: 14px;
    }
}
</style>

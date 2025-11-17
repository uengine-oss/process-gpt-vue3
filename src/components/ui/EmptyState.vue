<template>
    <div class="empty-state">
        <div v-if="isQueued" class="queued-state">
            <div class="thinking-wave-text">
                <div v-for="(char, index) in $t('agentMonitor.workQueued')" :key="index" 
                    :style="{ animationDelay: `${index * 0.1}s` }"
                    class="thinking-char"
                >{{ char === ' ' ? '\u00A0' : char }}
                </div>
                <p>{{ $t('agentMonitor.workStarted') }}</p>
            </div>
        </div>
        <div v-else>
            <h3>{{ $t('agentMonitor.noWorkInProgress') }}</h3>
            <p>{{ $t('agentMonitor.workStarted') }}</p>
        </div>
        <div v-if="!isQueued && !isA2A" class="start-controls">
            <v-container class="pa-0">
                <v-col cols="12" class="text-center mb-4">
                    <h3>{{ $t('agentMonitor.selectResearchMethod') }}</h3>
                </v-col>
                
                <v-row class="ma-0 pa-0">
                    <v-col v-for="option in orchestrationOptions" :key="option.value" 
                        cols="12" sm="12" md="6" class="d-flex"
                    >
                        <v-card 
                            :class="['method-card-vuetify', { 'selected': selectedOrchestrationMethod === option.value }]"
                            :color="selectedOrchestrationMethod === option.value ? 'primary' : 'white'"
                            :variant="selectedOrchestrationMethod === option.value ? 'elevated' : 'outlined'"
                            @click="selectOrchestrationMethod(option.value)"
                            hover
                            class="flex-fill d-flex flex-column"
                            style="height: 100%;"
                        >
                                <v-card-text class="text-center pa-4 flex-grow-1 d-flex flex-column justify-center">
                                    <div class="card-icon-vuetify mb-3">
                                        <Icons :icon="option.icon" :color="selectedOrchestrationMethod === option.value ? 'white' : 'black'" :size="50" />
                                    </div>
                                    <v-card-title class="card-title-vuetify pa-0 mb-2">{{ option.label }}</v-card-title>
                                    <v-card-subtitle class="card-description-vuetify pa-0">{{ getMethodDescription(option.value) }}</v-card-subtitle>
                                    <v-icon v-if="selectedOrchestrationMethod === option.value" 
                                                class="selected-indicator-vuetify" 
                                                color="white"
                                        >mdi-check-circle
                                    </v-icon>
                                </v-card-text>
                                <v-card-actions class="justify-end pa-4 pb-4 pr-4 mt-auto">
                                    <!-- <v-btn v-if="showDownloadButton" 
                                            @click="downloadBrowserAgent" 
                                            :disabled="selectedOrchestrationMethod !== option.value"
                                            :color="selectedOrchestrationMethod === option.value ? '' : 'primary'"
                                            variant="elevated" 
                                            class="rounded-pill"
                                            density="compact"
                                    >{{ $t('agentMonitor.download') }}</v-btn> -->
                                    <v-btn 
                                            @click="startTask" 
                                            :disabled="selectedOrchestrationMethod !== option.value"
                                            :color="selectedOrchestrationMethod === option.value ? '' : 'primary'"
                                            variant="elevated" 
                                            class="rounded-pill"
                                            density="compact"
                                    >{{ $t('agentMonitor.start') }}</v-btn>
                                </v-card-actions>
                        </v-card>
                    </v-col>
                </v-row>
                
                <v-row v-if="showDownloadButton" justify="center" class="ma-0 pa-0">
                    <v-col cols="auto">
                        <v-alert type="info" variant="tonal" color="gray" class="text-caption">
                            {{ $t('agentMonitor.browserUse') }}
                        </v-alert>
                    </v-col>
                </v-row>
            </v-container>
        </div>
    </div>
</template>

<script>
export default {
    props: {
        isQueued: {
            type: Boolean,
            default: false
        },
        orchestrationOptions: {
            type: Array,
            required: true
        },
        selectedOrchestrationMethod: {
            type: String,
            default: null
        },
        showDownloadButton: {
            type: Boolean,
            default: false
        },
        isA2A: {
            type: Boolean,
            default: false
        }
    },
    emits: ['selectOrchestrationMethod', 'startTask', 'downloadBrowserAgent'],
    methods: {
        selectOrchestrationMethod(value) {
            this.$emit('selectOrchestrationMethod', value)
        },
        startTask() {
            this.$emit('startTask')
        },
        downloadBrowserAgent() {
            this.$emit('downloadBrowserAgent')
        },
        getMethodDescription(method) {
            const descriptions = {
                'crewai-deep-research': this.$t('AgentSelectInfo.orchestration.crewaiDeepResearch.description'),
                'crewai-action': this.$t('AgentSelectInfo.orchestration.crewaiAction.description'),
                'openai-deep-research': this.$t('AgentSelectInfo.orchestration.openaiDeepResearch.description'),
                'langchain-react': this.$t('AgentSelectInfo.orchestration.langchainReact.description'),
                'browser-use': this.$t('AgentSelectInfo.orchestration.browserUse.description')
            };
            return descriptions[method] || '';
        }
    }
}
</script>

<style scoped>
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

/* Vuetify 카드 스타일 */
.start-controls {
    margin-top: 24px;
    width: 100%;
}

.method-title {
    font-size: 20px;
    font-weight: 600;
    color: #1d2129;
    margin-bottom: 0;
}

.method-card-vuetify {
    cursor: pointer;
    transition: all 0.3s ease;
    min-height: 240px;
    position: relative;
}

.method-card-vuetify:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15) !important;
}

.method-card-vuetify.selected {
    transform: translateY(-6px);
    box-shadow: 0 12px 30px rgba(25, 118, 210, 0.3) !important;
}

.card-icon-vuetify {
    font-size: 48px;
    line-height: 1;
    filter: grayscale(30%);
    transition: filter 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 60px;
}

.method-card-vuetify.selected .card-icon-vuetify {
    filter: none;
}

.card-title-vuetify {
    font-size: 16px !important;
    font-weight: 600 !important;
    line-height: 1.3 !important;
    color: #1d2129 !important;
}

.method-card-vuetify.selected .card-title-vuetify {
    color: white !important;
}

.card-description-vuetify {
    font-size: 12px !important;
    line-height: 1.5 !important;
    opacity: 0.85;
    word-break: keep-all;
    white-space: pre-line;
    text-align: left;
    color: #606770 !important;
}

.method-card-vuetify.selected .card-description-vuetify {
    color: rgba(255, 255, 255, 0.9) !important;
}

.selected-indicator-vuetify {
    position: absolute;
    top: 12px;
    right: 12px;
    animation: scaleIn 0.3s ease;
}

@keyframes scaleIn {
    from {
        transform: scale(0);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}

/* 반응형 디자인 */
@media (max-width: 768px) {
    .method-title {
        font-size: 18px;
    }
    
    .method-card-vuetify {
        min-height: 220px;
    }
    
    .card-icon-vuetify {
        font-size: 40px;
    }
    
    .card-title-vuetify {
        font-size: 15px !important;
    }
    
    .card-description-vuetify {
        font-size: 11px !important;
        line-height: 1.4 !important;
    }
}
</style>

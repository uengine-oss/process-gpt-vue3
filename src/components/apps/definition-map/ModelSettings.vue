<template>
    <v-dialog v-model="dialog" max-width="500px" persistent>
        <v-card>
            <v-card-title class="pa-4">
                <span class="text-h6">{{ $t('ModelSettings.title') }}</span>
            </v-card-title>
            <v-card-text class="px-4 pb-4" style="max-height: 400px; overflow-y: auto;">
                <div v-if="matchedAgents.length === 0" class="text-center py-4">
                    <div class="text-body-1 grey--text">설정할 에이전트가 없습니다</div>
                </div>
                <div v-else>
                    <div v-for="agent in matchedAgents" :key="agent.id" class="mb-4">
                        <div class="text-subtitle-1 font-weight-medium mb-2">{{ agent.name }}</div>
                        <v-row dense>
                            <v-col cols="5">
                                <v-select
                                    v-model="agent.provider"
                                    :items="providers"
                                    item-title="name"
                                    item-value="key"
                                    label="Provider"
                                    outlined
                                    dense
                                    @update:model-value="onProviderChange(agent)"
                                ></v-select>
                            </v-col>
                            <v-col cols="7">
                                <v-select
                                    v-model="agent.llmModel"
                                    :items="getModelsForProvider(agent.provider)"
                                    item-title="name"
                                    item-value="key"
                                    label="모델"
                                    outlined
                                    dense
                                    :disabled="!agent.provider"
                                ></v-select>
                            </v-col>
                        </v-row>
                    </div>
                </div>
            </v-card-text>
            <v-card-actions class="pa-4">
                <v-spacer></v-spacer>
                <v-btn text @click="closeDialog">취소</v-btn>
                <v-btn color="primary" @click="saveSettings">저장</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    props: {
        modelValue: Boolean,
        roleMappings: {
            type: Array,
            default: () => []
        }
    },
    data() {
        return {
            agentList: [],
            matchedAgents: [],
            providers: [
                { key: 'openai', name: 'OpenAI' },
                { key: 'anthropic', name: 'Claude (Anthropic)' },
                { key: 'gemini', name: 'Google Gemini' },
                { key: 'groq', name: 'Grok (xAI)' }
            ],
            modelsByProvider: {
                openai: [
                    { key: 'gpt-4.1', name: 'GPT-4.1' },
                    { key: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
                    { key: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
                    { key: 'gpt-4', name: 'GPT-4' },
                    { key: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
                    { key: 'gpt-4-32k', name: 'GPT-4 (32k)' },
                    { key: 'gpt-4o', name: 'GPT-4 Omni' },
                    { key: 'gpt-4o-mini', name: 'GPT-4 Omni Mini' },
                    { key: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
                    { key: 'gpt-3.5-turbo-16k', name: 'GPT-3.5 Turbo (16k)' }
                ],
                anthropic: [
                    { key: 'claude-sonnet-4', name: 'Claude Sonnet 4' },
                    { key: 'claude-opus-4', name: 'Claude Opus 4' },
                    { key: 'claude-3.7-sonnet', name: 'Claude 3.7 Sonnet' },
                    { key: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
                    { key: 'claude-3.5-haiku', name: 'Claude 3.5 Haiku' },
                    { key: 'claude-3-opus', name: 'Claude 3 Opus' },
                    { key: 'claude-3-sonnet', name: 'Claude 3 Sonnet' },
                    { key: 'claude-3-haiku', name: 'Claude 3 Haiku' },
                    { key: 'claude-2.1', name: 'Claude 2.1' },
                    { key: 'claude-instant', name: 'Claude Instant' }
                ],
                gemini: [
                    { key: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
                    { key: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
                    { key: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite' },
                    { key: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
                    { key: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite' },
                    { key: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
                    { key: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
                    { key: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash-8B' },
                    { key: 'gemini-1.0-ultra', name: 'Gemini 1.0 Ultra' },
                    { key: 'gemini-1.0-nano', name: 'Gemini 1.0 Nano' }
                ],
                groq: [
                    { key: 'grok-vision-beta', name: 'Grok Vision Beta' },
                    { key: 'grok-beta', name: 'Grok Beta' },
                    { key: 'grok-3-mini-fast', name: 'Grok 3 Mini Fast' },
                    { key: 'grok-3-mini', name: 'Grok 3 Mini' },
                    { key: 'grok-3-fast', name: 'Grok 3 Fast' },
                    { key: 'grok-3', name: 'Grok 3' },
                    { key: 'grok-2-mini', name: 'Grok 2 Mini' },
                    { key: 'grok-2', name: 'Grok 2' },
                    { key: 'grok-1.5', name: 'Grok 1.5' },
                    { key: 'grok-1', name: 'Grok 1' }
                ]
            }
        }
    },
    computed: {
        dialog: {
            get() {
                return this.modelValue;
            },
            set(value) {
                this.$emit('update:modelValue', value);
            }
        }
    },
    async mounted() {
        await this.loadAgents();
    },
    watch: {
        // roleMappings가 변경되면 자동으로 매칭 업데이트
        roleMappings: {
            handler() {
                if (this.agentList.length > 0) {
                    this.filterMatchedAgents();
                }
            },
            deep: true
        }
    },
    methods: {
        async loadAgents() {
            try {
                this.agentList = await backend.getAgentList();
                this.filterMatchedAgents();
            } catch (error) {
                console.error('Agent 목록 로드 실패:', error);
            }
        },
        
        // UUID 형태인지 확인하는 헬퍼 함수
        isValidAgentId(id) {
            return id && typeof id === 'string' && id.includes('-') && id.length > 20;
        },
        
        // endpoint에서 실제 agent ID들만 추출
        extractAgentIds() {
            return this.roleMappings
                .flatMap(role => Array.isArray(role.endpoint) ? role.endpoint : [role.endpoint])
                .filter(this.isValidAgentId);
        },
        
        filterMatchedAgents() {
            const agentIds = this.extractAgentIds();
            
            this.matchedAgents = this.agentList
                .filter(agent => agentIds.includes(agent.id))
                .map(agent => {
                    let provider = 'openai';
                    let llmModel = 'gpt-4';
                    
                    // 기존에 저장된 model 값이 있으면 파싱
                    if (agent.model && agent.model.includes('/')) {
                        const [savedProvider, savedModel] = agent.model.split('/');
                        provider = savedProvider;
                        llmModel = savedModel;
                    }
                    
                    return {
                        ...agent,
                        provider: provider,
                        llmModel: llmModel
                    };
                });
        },
        
        getModelsForProvider(provider) {
            return this.modelsByProvider[provider] || [];
        },
        
        onProviderChange(agent) {
            // Provider가 변경되면 해당 provider의 첫 번째 모델로 초기화
            const models = this.getModelsForProvider(agent.provider);
            if (models.length > 0) {
                agent.llmModel = models[0].key;
            }
        },
        closeDialog() {
            this.dialog = false;
        },
        saveSettings() {
            console.log('🚫 ModelSettings - saveSettings 호출됨 (putAgent 호출 없음, 임시저장만)');
            
            // 모델 설정 데이터를 가공해서 부모에게 전달 (실제 저장은 제출완료 시)
            const modelSettings = this.matchedAgents
                .filter(agent => agent.provider && agent.llmModel)
                .map(agent => ({
                    agentData: { ...agent },
                    modelValue: `${agent.provider}/${agent.llmModel}`
                }));
            
            console.log('📦 임시 저장할 모델 설정:', modelSettings);
            this.$emit('save', modelSettings);
            this.closeDialog();
        }
    }
}
</script>

<style scoped>
/* 심플한 스타일 유지 */
</style>

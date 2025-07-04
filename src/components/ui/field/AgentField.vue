<template>
    <div>
        <!-- 편집 모드가 아닐 때는 항상 생성 기능 표시 -->
        <UserInputGenerator
            class="agent-field-User-input-generator pb-2"
            v-if="!isEdit"
            :teamInfo="teamInfo"
            :type="type"
            :reset="resetGenerator"
            @input-generated="onInputGenerated"
            @generation-started="onGenerationStarted"
            @generation-finished="onGenerationFinished"
        />
        
        <!-- 생성 중일 때 스켈레톤 표시 -->
        <div v-if="isGenerating && !isEdit" class="agent-field-skeleton">
            <v-skeleton-loader
                type="image"
                class="mx-auto"
            ></v-skeleton-loader>
        </div>
        
        <!-- 데이터가 생성되었고 생성 중이 아닐 때만 나머지 필드 표시 -->
        <div v-if="showDetailFields">
            <ProfileField v-model="agent.img" />

            <div v-if="type === 'a2a'">
                <v-text-field 
                    v-model="agent.url" 
                    :label="$t('agentField.agentUrl')"
                    class="mb-2"
                    @click:append-inner="fetchAgentData"
                >
                    <template v-slot:append-inner>
                        <v-btn
                            :icon="true"
                            :loading="isLoading"
                            :disabled="!agent.url"
                            @click="fetchAgentData"
                            size="small"
                            variant="text"
                        >
                            <v-icon>{{ isLoading ? 'mdi-loading mdi-spin' : 'mdi-download' }}</v-icon>
                        </v-btn>
                    </template>
                </v-text-field>
                <v-text-field 
                    v-model="agent.name" 
                    :label="$t('agentField.agentName')" 
                    :rules="nameRules"
                    class="mb-2"
                ></v-text-field>
                <v-textarea
                    v-model="agent.description" 
                    :label="$t('agentField.agentDescription')"
                    class="mb-2"
                    rows="3"
                ></v-textarea>
                <v-combobox
                    v-model="selectedSkills"
                    :items="skills"
                    :label="$t('agentField.agentSkills')"
                    multiple
                    chips
                    clearable
                    closable-chips
                    variant="outlined"
                ></v-combobox>
            </div>

            <div v-else>
                <v-text-field 
                    v-model="agent.name" 
                    :label="$t('agentField.agentName')" 
                    :rules="nameRules"
                    class="mb-2"
                ></v-text-field>
                <v-text-field 
                    v-model="agent.role" 
                    :label="$t('agentField.agentRole')" 
                    class="mb-2"
                ></v-text-field>
                <v-text-field 
                    v-model="agent.goal" 
                    :label="$t('agentField.agentGoal')" 
                    class="mb-2"
                ></v-text-field>
                <v-textarea
                    v-model="agent.persona" 
                    :label="$t('agentField.agentPersona')" 
                    class="mb-2"
                    rows="3"
                ></v-textarea>
                <v-combobox
                    v-model="selectedTools"
                    :items="tools"
                    :label="$t('agentField.agentTools')"
                    multiple
                    chips
                    clearable
                    closable-chips
                    variant="outlined"
                ></v-combobox>
            </div>
        </div>
        
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import ProfileField from '@/components/ui/field/ProfileField.vue';
import UserInputGenerator from '@/components/ui/UserInputGenerator.vue';

export default {
    components: {
        ProfileField,
        UserInputGenerator
    },
    props: {
        modelValue: {
            type: Object,
            required: true,
            default: () => ({
                id: '',
                name: '',
                role: '',
                goal: '',
                persona: '',
                url: '',
                description: '',
                skills: ''
            })
        },
        teamInfo: {
            type: Object,
            default: () => ({}),
        },
        idRules: {
            type: Array,
            required: true,
            default: () => []
        },
        nameRules: {
            type: Array,
            required: true,
            default: () => []
        },
        isEdit: {
            type: Boolean,
            default: false
        },
        type: {
            type: String,
            required: true,
            default: 'agent'
        },
        dialogReset: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            agent: {
                id: '',
                name: '',
                role: '',
                goal: '',
                persona: '',
                isAgent: true,
                url: '',
                img: '',
                description: '',
                skills: ''
            },
            tools: [],
            selectedTools: [],
            skills: [],
            selectedSkills: [],
            isLoading: false,
            isDataGenerated: false,
            isGenerating: false,
            resetGenerator: false,
        }
    },
    computed: {
        showDetailFields() {
            return (this.isEdit || this.isDataGenerated) && !this.isGenerating;
        }
    },
    watch: {
        dialogReset(newVal) {
            if (newVal) {
                this.resetGenerator = true;
                this.isDataGenerated = false;
                this.isGenerating = false;
                // resetGenerator를 다시 false로 설정하여 다음 reset을 위해 준비
                this.$nextTick(() => {
                    this.resetGenerator = false;
                });
            }
        },
        modelValue: {
            handler(newVal) {
                this.agent = newVal;
            },
            deep: true
        },
        agent: {
            handler(newVal) {
                this.$emit('update:modelValue', newVal);
            },
            deep: true
        },
        selectedTools: {
            deep: true,
            handler(newVal) {
                this.agent.tools = newVal ? newVal.join(',') : '';
            }
        },
        selectedSkills: {
            deep: true,
            handler(newVal) {
                this.agent.skills = newVal ? newVal.join(',') : '';
            }
        }
    },
    async mounted() {
        if (this.modelValue && this.modelValue.isAgent) {
            this.agent = this.modelValue;
            if (this.agent.tools) this.selectedTools = this.agent.tools.split(',');
            if (this.agent.skills) this.selectedSkills = this.agent.skills.split(',');
        }
        if (!this.agent.id || this.agent.id == '') this.agent.id = this.uuid();
        if (this.type === 'agent') {
            await this.getTools();
        }
    },
    methods: {
        onGenerationStarted() {
            this.isGenerating = true;
        },
        onGenerationFinished() {
            this.isGenerating = false;
        },
        onInputGenerated(generatedData) {
            console.log('원시 생성 데이터:', generatedData);
            
            try {
                if (!generatedData.id) {
                    generatedData.id = this.uuid();
                }
                
                if (this.type === 'agent') {
                    if (generatedData.id) this.agent.id = generatedData.id;
                    if (generatedData.name) this.agent.name = generatedData.name;
                    if (generatedData.role) this.agent.role = generatedData.role;
                    if (generatedData.goal) this.agent.goal = generatedData.goal;
                    if (generatedData.persona) this.agent.persona = generatedData.persona;
                    
                    if (generatedData.tools) {
                        this.selectedTools = generatedData.tools.split(',').map(tool => tool.trim());
                    }
                } else if (this.type === 'a2a') {
                    if (generatedData.id) this.agent.id = generatedData.id;
                    if (generatedData.name) this.agent.name = generatedData.name;
                    if (generatedData.description) this.agent.description = generatedData.description;
                    
                    if (generatedData.skills) {
                        this.selectedSkills = generatedData.skills.split(',').map(skill => skill.trim());
                    }
                }
                
                this.isDataGenerated = true;
                
                console.log('에이전트 정보가 성공적으로 적용되었습니다');
                
            } catch (error) {
                console.error('생성된 데이터 처리 중 오류 발생:', error);
            }
        },
        uuid() {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        },
        async getTools() {
            const backend = BackendFactory.createBackend();
            const jsonData = await backend.getMCPTools();
            const tools = Object.keys(jsonData);
            this.tools = tools;
        },
        async fetchAgentData() {
            if (!this.agent.url) {
                this.$toast?.error('URL을 입력해주세요');
                return;
            }

            this.isLoading = true;
            try {
                const backend = BackendFactory.createBackend();
                const data = await backend.fetchAgentData(this.agent.url);
                console.log(data);

                if (data.name) this.agent.name = data.name;
                if (data.description) this.agent.description = data.description;
                if (data.skills) this.selectedSkills = data.skills.map(skill => skill.id);
                console.log(this.selectedSkills);

            } catch (error) {
                console.error('Error fetching agent data:', error);
            } finally {
                this.isLoading = false;
            }
        }
    }
}
</script>
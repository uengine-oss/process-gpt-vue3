<template>
    <div>
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
                v-model="agent.id" 
                :label="$t('agentField.agentId')" 
                :rules="idRules"
                class="mb-2"
                :readonly="isEdit"
            ></v-text-field>
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
                v-model="agent.id" 
                :label="$t('agentField.agentId')" 
                :rules="idRules"
                class="mb-2"
                :readonly="isEdit"
            ></v-text-field>
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
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import ProfileField from '@/components/ui/field/ProfileField.vue';

export default {
    components: {
        ProfileField
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
        }
    },
    watch: {
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
        if (this.type === 'agent') {
            await this.getTools();
        }
    },
    methods: {
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
                // this.$toast?.error('에이전트 데이터를 가져오는데 실패했습니다');
            } finally {
                this.isLoading = false;
            }
        }
    }
}
</script>
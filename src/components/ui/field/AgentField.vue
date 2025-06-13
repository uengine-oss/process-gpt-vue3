<template>
    <div>
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

        <div v-if="type === 'a2a'">
            <v-text-field 
                v-model="agent.url" 
                :label="$t('agentField.agentUrl')"
                class="mb-2"
            ></v-text-field>
            <v-textarea
                v-model="agent.description" 
                :label="$t('agentField.agentDescription')"
                class="mb-2"
                rows="3"
            ></v-textarea>
        </div>

        <div v-else>
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

export default {
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
                description: ''
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
                description: '',
            },
            tools: [],
            selectedTools: []
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
    },
    async mounted() {
        if (this.type === 'agent') {
            await this.getTools();
        }

        if (this.modelValue && this.modelValue.isAgent) {
            this.agent = this.modelValue;
            this.selectedTools = this.agent.tools.split(',');
        }
    },
    methods: {
        async getTools() {
            const backend = BackendFactory.createBackend();
            const jsonData = await backend.getMCPTools();
            const tools = Object.keys(jsonData);
            this.tools = tools;
        }
    }
}
</script>
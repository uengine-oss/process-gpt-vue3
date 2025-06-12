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
                label="URL"
                class="mb-2"
            ></v-text-field>
            <v-textarea
                v-model="agent.description" 
                label="Description"
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
        </div>
    </div>
</template>

<script>
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
            isEdit: false
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
        }
    },
    mounted() {
        console.log(this.modelValue)
        if (this.modelValue && this.modelValue.isAgent) {
            this.agent = this.modelValue;
            this.isEdit = true;
        }
    },
    methods: {
    }
}
</script>
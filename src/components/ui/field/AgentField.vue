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
                persona: ''
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
                isAgent: true
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
        if (this.modelValue && this.modelValue.id != '') {
            this.agent = this.modelValue;
            this.agent.isAgent = true;
            this.isEdit = true;
        }
    },
    methods: {
    }
}
</script>
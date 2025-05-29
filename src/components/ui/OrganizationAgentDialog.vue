<template>
    <v-card>
        <v-card-title>
            <span class="text-h6">{{ dialogTitle }}</span>
        </v-card-title>

        <v-card-text>
            <!-- edit agent-->
            <div v-if="dialogType == 'edit'">
                <AgentField v-model="editAgent.data" :idRules="idRules" :nameRules="nameRules" />
            </div>

            <div v-else-if="dialogType == 'delete'">
                <v-alert icon="$warning" color="warning" variant="outlined" density="compact" class="mb-4">
                    <div class="text-body-1">{{ $t('organizationChartDefinition.deleteAgentExplanation') }}</div>
                </v-alert>
                <div>'{{ editAgent.data.name }}' {{ $t('organizationChartDefinition.deleteMessage') }}</div>
            </div>
        </v-card-text>

        <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="primary" @click="update" :disabled="!isValid">{{ buttonText }}</v-btn>
            <v-btn color="error" @click="closeDialog">{{ $t('organizationChartDefinition.close') }}</v-btn>
        </v-card-actions>
    </v-card>
</template>

<script>
import AgentField from './field/AgentField.vue';

export default {
    components: {
        AgentField
    },
    props: {
        dialogType: {
            type: String,
            default: '',
        },
        editAgent: {
            type: Object,
            default: {},
        },
    },
    data: () => ({
    }),
    computed: {
        idRules() {
            return [
                (value) => !!value || this.$t('organizationChartDefinition.idRequired'),
            ];
        },
        nameRules() {
            return [
                (value) => !!value || this.$t('organizationChartDefinition.nameRequired'),
            ];
        },
        isValid() {
            if (this.dialogType == 'edit') {
                return this.nameRules.every(rule => rule(this.editAgent.name) === true);
            } else {
                return true
            }
        },
        dialogTitle() {
            if (this.dialogType == 'edit') {
                return this.$t('organizationChartDefinition.agent') + ' ' + this.$t('organizationChartDefinition.edit')
            } else if (this.dialogType == 'delete') {
                return this.$t('organizationChartDefinition.agent') + ' ' + this.$t('organizationChartDefinition.delete')
            }
        },
        buttonText() {
            if (this.dialogType == 'edit') {
                return this.$t('organizationChartDefinition.edit')
            } else if (this.dialogType == 'delete') {
                return this.$t('organizationChartDefinition.delete')
            }
        }
    },
    mounted() {
    },
    methods: {
        closeDialog() {
            this.$emit('closeDialog')
        },
        update() {
            if (this.dialogType == 'edit') {
                this.editAgent.name = this.editAgent.data.name
            }
            this.$emit('updateAgent', this.dialogType, this.editAgent)
        },
    }
}
</script>

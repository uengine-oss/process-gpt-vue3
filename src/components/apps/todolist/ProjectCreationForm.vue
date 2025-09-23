<template>
    <div>
        <v-card class="pa-0">
            <v-row class="ma-0 pa-4 align-center">
                <v-card-title class="pa-0">
                    <h4 class="text-h4">{{ $t('ProjectCreationForm.title') }}</h4>
                </v-card-title>
                <v-spacer></v-spacer>
                <v-btn @click="close"
                    class="ml-auto" 
                    variant="text" 
                    density="compact"
                    icon
                >
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-row>

            <v-card-text class="pa-0 pl-4 pr-4">
                <v-text-field 
                    v-model="project.name" 
                    :label="$t('ProjectCreationForm.projectName')" 
                    autofocus 
                    required 
                    style="margin-bottom: 10px;"
                ></v-text-field>
                <v-text-field 
                    v-model="project.startDate" 
                    :label="$t('ProjectCreationForm.startDate')" 
                    type="datetime-local" 
                    required 
                    style="margin-bottom: 10px;"
                ></v-text-field>
                <v-text-field 
                    v-model="project.dueDate" 
                    :label="$t('ProjectCreationForm.dueDate')" 
                    type="datetime-local" 
                    required
                ></v-text-field>
            </v-card-text>

            <v-row class="ma-0 pa-4">
                <v-spacer></v-spacer>
                <v-btn @click="save"
                    :disabled="project.name == ''"
                    color="primary" 
                    rounded 
                    variant="flat" 
                >
                    {{ $t('ProjectCreationForm.create') }}
                </v-btn>
            </v-row>
        </v-card>
    </div>
</template>

<script>
export default {
    data: () => ({
        project: {
            name: '',
            startDate: null,
            dueDate: null,
        },
    }),
    methods: {
        close() {
            this.$emit('close')
        },
        save() {
            this.$emit('save', this.project)
        },
        
    },
}
</script>
<template>
    <div>
        <v-card>
            <v-card-title class="pt-5 pl-5 d-flex align-center">
                <h4 class="text-h4">{{ $t('ProjectCreationForm.title') }}</h4>
                <v-spacer></v-spacer>
                <v-btn icon variant="text" @click="close" class="ml-auto">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>
            <v-card-text class="pa-0 pl-4 pr-4 pb-4">
                <v-text-field v-model="project.name" :label="$t('ProjectCreationForm.projectName')" autofocus required style="margin-bottom: 10px;"></v-text-field>
                <v-text-field v-model="project.startDate" :label="$t('ProjectCreationForm.startDate')" type="datetime-local" required style="margin-bottom: 10px;"></v-text-field>
                <v-text-field v-model="project.dueDate" :label="$t('ProjectCreationForm.dueDate')" type="datetime-local" required></v-text-field>
            </v-card-text>

            <v-card-actions class="justify-end pt-0">
                <v-btn @click="save"
                    :disabled="project.name == ''"
                    color="primary"
                    variant="flat"
                    rounded
                >{{ $t('ProjectCreationForm.create') }}</v-btn>
            </v-card-actions>
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
<template>
    <div>
        <v-card>
            <v-card-title  class="pt-5 pl-5">
                <h4 class="text-h4">프로젝트 생성</h4>
            </v-card-title>
            <v-card-text>
                <v-text-field v-model="project.name" label="프로젝트 명" autofocus required style="margin-bottom: 10px;"></v-text-field>
                <v-text-field v-model="project.startDate" label="시작일" type="datetime-local" required style="margin-bottom: 10px;"></v-text-field>
                <v-text-field v-model="project.dueDate" label="마감일" type="datetime-local" required></v-text-field>
            </v-card-text>

            <v-card-actions class="justify-center pt-0">
                <v-btn :disabled="project.name == ''" color="primary" variant="flat" @click="save">생성</v-btn>
                <v-btn color="error" variant="flat" @click="close">닫기</v-btn>
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
<template>
    <v-card class="process-feedback-popup" elevation="8">
        <v-skeleton-loader
            v-if="isLoading"
            type="image"
            class="mx-auto"
        ></v-skeleton-loader>

        <v-card-text v-else class="pa-3">
            <div class="text-subtitle-2 mb-2">피드백을 선택해주세요:</div>
            <v-list class="feedback-list">
                <v-list-item
                    v-for="(item, index) in feedbackItems"
                    :key="'feedback-'+index"
                    :active="feedbackValue === item"
                    @click="feedbackValue = item"
                    class="feedback-item"
                >
                    <v-list-item-title>{{ item }}</v-list-item-title>
                </v-list-item>
                <v-list-item
                    :active="feedbackValue === 'etc'"
                    @click="feedbackValue = 'etc'"
                    class="feedback-item"
                >
                    <v-list-item-title>기타</v-list-item-title>
                </v-list-item>
            </v-list>
            <v-textarea v-if="feedbackValue == 'etc'" v-model="feedbackText" label="기타" rows="3" />

            <div class="d-flex justify-end mt-3">
                <v-btn size="small" variant="text" @click="closePopup">취소</v-btn>
                <v-btn size="small" color="primary" @click="submitFeedback" class="ml-2" :disabled="!feedbackValue">제출</v-btn>
            </div>
        </v-card-text>
    </v-card>
</template>

<script>
import BackendFactory from "@/components/api/BackendFactory";
const backend = BackendFactory.createBackend();

export default {
    props: {
        processInstance: Object,
        isOpen: Boolean,
    },
    data: () => ({
        feedbackValue: null,
        feedbackItems: [],
        feedbackText: '',
        isLoading: false,
    }),
    async mounted() {
        this.isLoading = true;
        await this.getFeedbackItems();
    },
    methods: {
        async getFeedbackItems() {
            const worklist = await backend.getWorkList({
                match: {
                    instId: this.processInstance.instId,
                    status: 'DONE'
                },
                orderBy: 'updated_at',
                sort: 'desc',
                size: 1
            });
            const workItem = worklist[0];
            if (workItem) {
                const taskId = workItem.taskId;
                const obj = {
                    processDefinitionId: workItem.defId,
                    activityId: workItem.tracingTag,
                    taskId: taskId,
                }
                const items = await backend.getFeedbackItems(obj);
                if (items) {
                    this.feedbackItems = items;
                }
                this.isLoading = false;
            }
        },
        submitFeedback() {
            // 피드백 제출 로직
            if (this.feedbackValue) {
                if (this.feedbackValue == 'etc') {
                    this.feedbackValue = this.feedbackText;
                }
                console.log('피드백 제출:', this.feedbackValue);
                this.closePopup();
            }
        },
        closePopup() {
            this.$emit('closePopup');
        }
    }
}
</script>

<style scoped>
.process-feedback-popup {
    position: fixed;
    bottom: 30px;
    right: 10px;
    z-index: 1000;
    min-width: 350px;
    max-width: 500px;
    margin-top: 8px;
    background: white;
    border-radius: 8px;
}

.feedback-list {
    max-height: 200px;
    overflow-y: auto;
    margin-bottom: 16px;
}

.feedback-item {
    cursor: pointer;
    border-radius: 4px;
    margin-bottom: 4px;
    padding: 8px 12px !important;
}

.feedback-item:hover {
    background-color: #f5f5f5 !important;
}

.feedback-item .v-list-item-title {
    white-space: normal !important;
    word-wrap: break-word !important;
    line-height: 1.4 !important;
    font-size: 14px !important;
    padding: 4px 0 !important;
}

.feedback-item .v-list-item__content {
    padding: 0 !important;
}
</style>
<template>
    <v-card class="process-feedback" elevation="2">
            <v-skeleton-loader
                v-if="isLoading"
                type="image"
                class="mx-auto"
            ></v-skeleton-loader>

            <v-card-text v-else-if="!isLoading && isAcceptMode" class="pa-3">
                <div class="text-h6 mb-3">피드백 반영</div>
                <v-table class="diff-table">
                    <thead>
                        <tr>
                            <th class="text-left">반영 여부</th>
                            <th class="text-left">속성</th>
                            <th class="text-left">피드백 반영 전</th>
                            <th class="text-left">피드백 반영 후</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(item, key) in diffItems" :key="key">
                            <td>
                                <v-checkbox v-model="item.accepted" color="primary" density="compact" />
                            </td>
                            <td>{{ item.title }}</td>
                            <td>
                                <div v-if="Array.isArray(item.before)">
                                    <v-list density="compact" class="diff-list">
                                        <v-list-item
                                            v-for="(listItem, index) in item.before"
                                            :key="`${key}-before-${index}`"
                                            class="px-2"
                                        >
                                            <v-list-item-title class="text-body-2">
                                                <template v-if="typeof listItem === 'object' && listItem.name">
                                                    <div class="font-weight-medium">{{ listItem.name }}</div>
                                                </template>
                                                <template v-else>
                                                    {{index+1}}. {{ listItem }}
                                                </template>
                                            </v-list-item-title>
                                        </v-list-item>
                                    </v-list>
                                </div>
                                <div v-else>
                                    <div class="text-body-2 pa-2">{{ item.before }}</div>
                                </div>
                            </td>
                            <td>
                                <div v-if="Array.isArray(item.after)">
                                    <v-list density="compact" class="diff-list">
                                        <v-list-item
                                            v-for="(listItem, index) in item.after"
                                            :key="`${key}-after-${index}`"
                                            class="px-2"
                                        >
                                            <v-list-item-title class="text-body-2">
                                                <template v-if="typeof listItem === 'object' && listItem.name">
                                                    <div class="font-weight-medium">{{ listItem.name }}</div>
                                                </template>
                                                <template v-else>
                                                    {{index+1}}. {{ listItem }}
                                                </template>
                                            </v-list-item-title>
                                        </v-list-item>
                                    </v-list>
                                </div>
                                <div v-else>
                                    <div class="text-body-2 pa-2">{{ item.after }}</div>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </v-table>

                <v-row class="ma-0 pa-0">
                    <v-spacer></v-spacer>
                    <v-btn @click="closeFeedback"
                        color="gray"
                        variant="elevated" 
                        class="rounded-pill mr-2"
                        density="compact"
                    >취소</v-btn>
                    <v-btn @click="setFeedbackDiff"
                        color="primary"
                        variant="elevated" 
                        class="rounded-pill"
                        density="compact"
                    >반영</v-btn>
                </v-row>
            </v-card-text>

            <v-card-text v-else-if="!isLoading && !isAcceptMode" class="pa-3">
                <div class="text-h6 mb-2 text-left">피드백을 선택해주세요:</div>
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

                <v-row class="ma-0 pa-0">
                    <v-spacer></v-spacer>
                    <v-btn @click="closeFeedback"
                        :disabled="!feedbackValue"
                        color="gray"
                        variant="elevated" 
                        class="rounded-pill mr-2"
                        density="compact"
                    >취소</v-btn>
                    <v-btn @click="submitFeedback"
                        :disabled="!feedbackValue"
                        color="primary"
                        variant="elevated" 
                        class="rounded-pill"
                        density="compact"
                    >제출</v-btn>
                </v-row>
            </v-card-text>
    </v-card>
</template>

<script>
import BackendFactory from "@/components/api/BackendFactory";
const backend = BackendFactory.createBackend();

export default {
    props: {
        lastMessage: Object,
        task: Object,
        isAcceptMode: Boolean,
    },
    data: () => ({
        isLoading: false,
        feedbackValue: null,
        feedbackItems: [],
        feedbackText: '',

        diffItems: {
            inputData: {
                title: '입력 데이터',
                before: [],
                after: [],
                accepted: true
            },
            checkpoints: {
                title: '체크포인트',
                before: [],
                after: [],
                accepted: true
            },
            description: {
                title: '설명',
                before: '',
                after: '',
                accepted: true
            },
            instruction: {
                title: '지시사항',
                before: '',
                after: '',
                accepted: true
            }
        },
        feedbackDiff: {
            inputData: [],
            checkpoints: [],
            description: '',
            instruction: ''
        }
    }),
    async mounted() {
        if (this.task && !this.isAcceptMode) {
            this.isLoading = true;
            await this.getFeedback();
        } else if (this.task && this.isAcceptMode) {
            this.isLoading = true;
            await this.getFeedbackDiff();
        }
    },
    methods: {
        async getFeedback() {
            const obj = {
                processDefinitionId: this.task.defId,
                activityId: this.task.tracingTag,
                taskId: this.task.taskId,
            }
            const items = await backend.getFeedback(obj);
            if (items) {
                this.feedbackItems = items;
            }
            this.isLoading = false;
        },
        async submitFeedback() {
            if (this.feedbackValue) {
                if (this.feedbackValue == 'etc') {
                    this.feedbackValue = this.feedbackText;
                }
                await backend.submitFeedback(this.feedbackValue, this.task.taskId);
                this.$emit('submitFeedback', this.task.taskId);
            }
        },
        closeFeedback() {
            this.$emit('closeFeedback');
        },
        async getFeedbackDiff() {
            const diff = await backend.getFeedbackDiff(this.task.taskId);
            if (diff && diff.modifications) {
                for (const key in diff.modifications) {
                    if (diff.modifications[key] && diff.modifications[key].changed) {
                        this.diffItems[key].before = diff.modifications[key].before;
                        this.diffItems[key].after = diff.modifications[key].after;
                    } else {
                        delete this.diffItems[key];
                    }
                }
            }
            this.isLoading = false;
        },
        async setFeedbackDiff() {
            if (!this.task || !this.diffItems || this.diffItems.length == 0) {
                return;
            }
            Object.keys(this.diffItems).forEach(key => {
                if (this.diffItems[key].accepted) {
                    this.feedbackDiff[key] = this.diffItems[key].after;
                }
            });
            if (this.feedbackDiff && this.feedbackDiff.inputData) {
                this.feedbackDiff.inputData = this.feedbackDiff.inputData.map(item => item.key);
            }
            await backend.setFeedbackDiff(this.feedbackDiff, this.task.tracingTag, this.task.defId);
            this.closeFeedback();
        },

    }
}
</script>

<style scoped>
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

.diff-table {
    width: 100%;
    table-layout: fixed;
}

.diff-table th,
.diff-table td {
    width: 25%;
}

.diff-table td {
    border-top: 1px solid #e0e0e0;
    border-bottom: 1px solid #e0e0e0;
}

.diff-table th:first-child,
.diff-table td:first-child {
    width: 60px;
}

.diff-table th:nth-child(2),
.diff-table td:nth-child(2) {
    width: 100px;
}

.diff-table th:nth-child(3),
.diff-table td:nth-child(3),
.diff-table th:nth-child(4),
.diff-table td:nth-child(4) {
    width: calc(50% - 70px);
}

.diff-list {
    max-height: 200px;
    overflow-y: auto;
    background-color: #fafafa;
}

.text-body-2 {
    word-wrap: break-word !important;
    word-break: break-word !important;
    white-space: normal !important;
    line-height: 1.4 !important;
    overflow-wrap: break-word !important;
}

.v-list-item-title {
    word-wrap: break-word !important;
    word-break: break-word !important;
    white-space: normal !important;
    line-height: 1.4 !important;
    overflow-wrap: break-word !important;
}
</style>
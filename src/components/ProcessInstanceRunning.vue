<template>
    <div>
        <v-card-text class="pa-4">
            <perfect-scrollbar class="h-100" ref="scrollContainer" @scroll="handleScroll">
                <div class="d-flex w-100 chat-view-box">
                    <v-col>
                        <div class="px-1 py-1">
                            <div style="margin-top: -20px;">
                                <v-row class="ma-0 pa-0">
                                    <v-row class="ma-0 pa-0 d-flex align-center mb-2">
                                        <v-avatar size="40" style="margin-right:10px;">
                                            <img src="@/assets/images/chat/chat-icon.png" height="40" width="40" />
                                        </v-avatar>
                                        <div class="user-name">System</div>
                                    </v-row>
                                </v-row>
                                <div class="w-100 pb-3">
                                    <div class="progress-border">
                                        <v-sheet class="chat-message-bubble rounded-md px-3 py-2" :class="'other-message'">
                                            <pre class="text-body-1">{{ streamingText }}</pre>
                                        </v-sheet>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </v-col>
                </div>
            </perfect-scrollbar>
        </v-card-text>
    </div>
</template>

<script>
import BackendFactory from "@/components/api/BackendFactory";
const backend = BackendFactory.createBackend();

export default {
    props: {
        instance: Object
    },
    data() {
        return {
            workItem: null,
            title: '',
            streamingText: '...',
            taskId: ''
        }
    },
    async mounted() {
        if (this.instance.status == 'NEW') {
            const worklist = await backend.getWorkListByInstId(this.instance.instanceId);
            this.workItem = worklist[0];
            this.taskId = this.workItem.taskId;
        }

        await backend.getTaskLog(this.taskId, async (task) => {
            this.streamingText = task.log;
            if (task.status == "DONE") {
                this.$emit('updated');
                this.EventBus.emit('instances-updated');

                if (task.description && task.description.length > 0 && task.description.includes("WorkItem Error")) {
                    const retry = window.confirm("워크아이템 실행 중 오류가 발생했습니다. 다시 시도하시겠습니까?");
                    if (retry) {
                        await backend.putWorkItemComplete(this.taskId, this.workItem);
                    } else {
                        this.$router.go(-1);
                    }
                }
            }
        });
    }
}
</script>

<style scoped>
.chat-view-box {
    height: calc(100vh - 220px);
    overflow: auto;
}

.chat-message-bubble {
  position: relative;
  max-width: 70%;
  margin-bottom: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1) !important;
}

.other-message {
  margin-right: auto;
  background-color: #f1f1f1 !important;
  border-radius: 3px 15px 15px 15px !important;
}
</style>


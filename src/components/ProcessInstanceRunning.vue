<template>
    <v-card elevation="10" style="height: calc(100vh - 131px);">
        <div class="d-flex">
            <div class="px-3 py-3 pb-2 pl-4 align-center">
                <div class="d-flex">
                    <h5 class="text-h5 font-weight-semibold">
                        {{ title }}
                    </h5>
                </div>
            </div>
        </div>
        <v-divider></v-divider>

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
    </v-card>
</template>

<script>
import BackendFactory from "@/components/api/BackendFactory";
const backend = BackendFactory.createBackend();

export default {
    data() {
        return {
            workItem: null,
            processDefinition: null,
            title: '',
            streamingText: '...',
        }
    },
    computed: {
        taskId() {
            return this.$route.query.taskId;
        }
    },
    watch: {
    },
    async mounted() {
        console.log(this.taskId);
        this.workItem = await backend.getWorkItem(this.taskId);
        if (this.workItem && this.workItem.worklist) {
            if (this.workItem.worklist.defId) {
                this.processDefinition = await backend.getRawDefinition(this.workItem.worklist.defId);

                if (this.workItem.worklist.instId == "new") {
                    this.title = this.processDefinition.name + this.$t('runningInstance.running');
                } else {
                    this.title = this.workItem.activity.name + this.$t('runningInstance.running');
                }
            }

            if (this.workItem.worklist.status == "COMPLETED") {
                const instId = btoa(encodeURIComponent(this.workItem.worklist.instId));
                this.$router.push(`/instancelist/${instId}`);
            }
        }

        await backend.getTaskLog(this.taskId, async (task) => {
            this.streamingText = task.log;
            if (task.status == "DONE") {
                this.EventBus.emit('instances-updated');

                if (task.description && task.description.length > 0 && task.description.includes("WorkItem Error")) {
                    const retry = window.confirm("워크아이템 실행 중 오류가 발생했습니다. 다시 시도하시겠습니까?");
                    if (retry) {
                        await backend.putWorkItemComplete(this.taskId, this.workItem);
                    } else {
                        if (task.proc_inst_id && task.proc_inst_id != "new") {
                            const instId = btoa(encodeURIComponent(task.proc_inst_id));
                            this.$router.push(`/instancelist/${instId}`);
                        } else {
                            this.$router.go(-1);
                        }
                    }
                }

                if (task.proc_inst_id && task.proc_inst_id != "new") {
                    const instId = btoa(encodeURIComponent(task.proc_inst_id));
                    this.$router.push(`/instancelist/${instId}`);
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


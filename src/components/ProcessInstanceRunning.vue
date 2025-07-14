<template>
    <div>
        <v-card-text class="pa-4">
            <perfect-scrollbar class="h-100 chat-view-box" ref="scrollContainer" @scroll="handleScroll">
                <BpmnUengine class="instance-running-bpmn-viewer"
                    style="width: 100%; height: 100%;"
                    :bpmn="bpmn"
                    :key="defCnt"
                    :lineAnimation="true"
                    :taskStatus="taskStatus"
                    :isViewMode="true"
                    :isAdmin="isAdmin"
                ></BpmnUengine>
                <v-divider class="my-2"></v-divider>
                <div class="d-flex w-100">
                    <v-col>
                        <div class="px-1 py-1">
                            <v-row class="ma-0 pa-0">
                                <v-row class="ma-0 pa-0 d-flex align-center mb-2">
                                    <v-avatar size="40" style="margin-right:10px;">
                                        <img src="@/assets/images/chat/chat-icon.png" :height="40" :width="40" />
                                    </v-avatar>
                                    <div class="user-name">System</div>
                                </v-row>
                            </v-row>
                            <div class="w-100 pb-3">
                                <div class="progress-border">
                                    <v-sheet class="chat-message-bubble rounded-md px-3 py-2 other-message">
                                        <!-- Instance 정보 고정 표시 -->
                                        <div class="instance-info mb-3">
                                            <div class="instance-details">
                                                <div class="detail-item">
                                                    <div class="detail-label">프로세스 ID:</div>
                                                    <div class="detail-value">{{ instance.defId }}</div>
                                                </div>
                                                <div class="detail-item">
                                                    <div class="detail-label">시작 시간:</div>
                                                    <div class="detail-value">{{ formattedStartDate }}</div>
                                                </div>
                                                <div class="detail-item" v-if="instance.roleBindings && instance.roleBindings.length > 0">
                                                    <div class="detail-label">역할 바인딩:</div>
                                                    <div class="detail-value">
                                                        <div v-for="role in instance.roleBindings" :key="role.name">
                                                            {{ role.name }} : {{ role.default }}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <!-- 업다운 버튼 (항상 표시) -->
                                        <v-row class="pa-0 ma-0 d-flex justify-end mb-2">
                                            <v-btn @click="toggleDetails"
                                                rounded
                                            >
                                                <span class="mr-1">생성중 세부내용</span>
                                                <v-icon v-if="isShowDetails">mdi-chevron-up</v-icon>
                                                <v-icon v-else>mdi-chevron-down</v-icon>
                                            </v-btn>
                                        </v-row>
                                        
                                        <!-- 세부 내용 -->
                                        <div v-if="isShowDetails">
                                            <pre class="text-body-1">
                                                {{ detailContent }}
                                            </pre>
                                        </div>
                                        
                                    </v-sheet>
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
import BpmnUengine from '@/components/BpmnUengineViewer.vue';
const backend = BackendFactory.createBackend();

export default {
    components: {
        BpmnUengine,
    },
    props: {
        instance: Object
    },
    data() {
        return {
            workItem: null,
            title: '',
            streamingText: '...',
            detailContent: '',
            isShowDetails: false, // 기본 접힌 상태
            taskId: '',
            subscription: null,
            bpmn: '',
            defCnt: 0,
            taskStatus: null
        }
    },
    async mounted() {
        if (this.instance.status == 'NEW') {
            const worklist = await backend.getWorkListByInstId(this.instance.instId);
            const definition = await backend.getRawDefinition(worklist[0].defId)
            this.workItem = worklist[0];
            this.taskId = this.workItem.taskId;
            this.bpmn = definition.bpmn
            this.taskStatus = await backend.getActivitiesStatus(this.instance.instId);
            this.defCnt++
        }

        this.subscription = await backend.getTaskLog(this.taskId, async (task) => {
            if (task.log) {
                this.streamingText = task.log;
                this.parseTaskLog(task.log);
            }
            if (task.status == "DONE") {
                this.EventBus.emit('instances-updated');
                this.$emit('updated');
            }
        });
    },
    computed: {
        formattedStartDate() {
            if (!this.instance.startDate) return '';
            return new Date(this.instance.startDate).toLocaleString('ko-KR');
        },
    },
    methods: {
        parseTaskLog(log) {
            if (!log) {
                return;
            }
            
            try {
                const parsedLog = JSON.parse(log);
                this.detailContent = JSON.stringify(parsedLog, null, 2);
            } catch (error) {
                // JSON 파싱 실패 시 원본 텍스트 사용
                this.detailContent = log;
            }
        },
        toggleDetails() {
            this.isShowDetails = !this.isShowDetails;
        }
    },
    beforeUnmount() {
        if (this.subscription) {
            console.log('Unsubscribing from task log for taskId:', this.taskId);
            window.$supabase.removeChannel(this.subscription);
        }
    }
}
</script>

<style scoped>
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

.message-actions {
  justify-content: flex-end;
}

.action-btn {
  min-width: 24px !important;
  height: 24px !important;
}

.instance-info {
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 12px;
}

.detail-item {
  gap: 8px;
  margin-bottom:16px;
}

.detail-label {
  font-weight: 600;
  color: #666;
  min-width: 120px;
  font-size: 14px;
}

.detail-value {
  color: #333;
  font-size: 14px;
  word-break: break-all;
}

</style>


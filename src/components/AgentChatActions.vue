<template>
    <div class="agent-actions">
        <AgentMonitor :workItem="workItem"
            :isActionsMode="true"
            :howToUseInfo="howToUseInfo"
        />
    </div>
</template>

<script>
import AgentMonitor from "@/views/markdown/AgentMonitor.vue";

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        AgentMonitor
    },
    props: {
        agentInfo: {
            type: Object,
            required: true
        },
    },
    data: () => ({
        instance: null,
        workItem: {
            worklist: {
                orchestration: 'crewai-action'
            }
        },
        howToUseInfo: {
            text: 'agentChat.actionsModeInfo'
        }
    }),
    computed: {
        id() {
            return this.$route.params.id;
        },
        instId() {
            return this.agentInfo?.id ? `${this.agentInfo.id}-actions` : '';
        }
    },
    created() {
    },
    async mounted() {
        await this.init();
        if (this.agentInfo.agent_type) {
            this.workItem.worklist.orchestration = this.agentInfo.agent_type;
        }
    },
    methods: {
        uuid() {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        },
        async init() {
            this.instance = await backend.getInstance(this.instId);
            if (!this.instance) {
                const instanceData = {
                    proc_inst_id: this.instId,
                    current_activity_ids: [],
                    participants: [this.id],
                    role_bindings: null,
                    variables_data: null,
                    status: 'NEW',
                    tenant_id: window.$tenantName,
                    start_date: new Date().toISOString(),
                    end_date: null,
                    due_date: null,
                    project_id: null,
                }
                await backend.putInstance(this.instId, instanceData);
                this.instance = await backend.getInstance(this.instId);
            }

            let worklist = await backend.getWorkListByInstId(this.instId);
            if (worklist.length > 0) {
                worklist = worklist.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                this.workItem = await backend.getWorkItem(worklist[0].taskId);
            }
        },
        // 새로운 workItem 생성
        async createWorkItem(data) {
            try {
                const agentOrch = data.agentOrch || 'crewai-action';
                const taskId = this.uuid();
                const newMessage = {
                    name: localStorage.getItem('userName'),
                    role: 'user',
                    email: localStorage.getItem('email'),
                    image: '',
                    content: data.message,
                    timeStamp: new Date().toISOString()
                }
                await backend.updateInstanceChat(this.instId, newMessage);
                const newWorkItem = await backend.putWorkItem(taskId, {
                    id: taskId,
                    proc_inst_id: this.instId,
                    user_id: this.id,
                    description: data.message,
                    query: data.message,
                    tool: "formHandler:",
                    status: 'IN_PROGRESS',
                    agent_mode: 'DRAFT',
                    agent_orch: data.agentOrch || 'crewai-action',
                });
                this.workItem = await backend.getWorkItem(taskId);
                return this.workItem;
            } catch (error) {
                console.error('새로운 작업 항목 생성 중 오류가 발생했습니다:', error);
                return null;
            }
        }
    }
}
</script>

<style scoped>
.agent-actions {
    width: 100%;
    height: 100%;
}
</style>

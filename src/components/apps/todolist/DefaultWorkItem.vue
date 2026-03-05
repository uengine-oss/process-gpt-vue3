<template>
    <v-row v-if="!isCompleted && showButtonByStatus" class="ma-0 pa-0 task-btn" style="right: 10px">
        <v-spacer></v-spacer>
        <v-btn v-if="claimButtonType === 'claim'" @click="assignTask()" color="primary" rounded class="mr-1">{{ $t('DefaultWorkItem.assignTask') }}</v-btn>
        <v-btn v-if="claimButtonType === 'unclaim'" @click="unAssignTask()" color="primary" rounded class="mr-1">{{ $t('DefaultWorkItem.unAssignTask') }}</v-btn>
        <v-btn v-if="showTaskReturnButton" @click="openTaskReturnDialog" color="warning" rounded class="mr-1"> {{ $t('DefaultWorkItem.returnTask') }}</v-btn>
        <v-tooltip v-if="showTaskSkipButton" location="bottom">
            <template #activator="{ props }">
                <span v-bind="props" class="mr-1 d-inline-flex">
                    <v-btn
                        :disabled="!taskSkipEnabled"
                        :loading="isLoadingSkipEligibility"
                        @click="requestSkip"
                        color="secondary"
                        rounded
                        variant="outlined"
                    >
                        {{ $t('DefaultWorkItem.skip') }}
                    </v-btn>
                </span>
            </template>
            <span>{{ taskSkipTooltip }}</span>
        </v-tooltip>
        <v-btn v-if="!isDryRun" @click="intermediateSave" color="primary" rounded class="mr-1">{{ $t('DefaultWorkItem.intermediateSave') }}</v-btn>
        <v-btn @click="executeProcess" color="primary" rounded>{{ $t('DefaultWorkItem.complete') }}</v-btn>
    </v-row>
    <div class="pa-4" style="height: 100%">
        <div class="d-flex flex-column overflow-y-auto" style="height: 100%">
            <div v-if="outputItems && outputItems.length > 0">
                <v-row class="w-100" v-for="item in outputItems" :key="item.name">
                    <v-col cols="5">
                        <v-list-subheader>{{ item.key }}</v-list-subheader>
                    </v-col>
                    <v-col cols="7">
                        <v-list-subheader>{{ item.value }}</v-list-subheader>
                    </v-col>
                </v-row>
            </div>
            <div v-if="!isCompleted">
                <DefaultForm v-if="inputItems && inputItems.length > 0" :inputItems="inputItems" />
            </div>
        </div>
    </div>

    <v-dialog v-model="taskReturnDialog" width="640">
        <TaskReturnForm
            v-if="taskReturnDialog"
            :taskId="taskIdForReturn"
            :workItem="workItem"
            @close="taskReturnDialog = false"
            @returned="onTaskReturned"
        />
    </v-dialog>

    <v-dialog v-model="skipDialog" width="560">
        <v-card>
            <v-card-title class="d-flex align-center">
                <span>{{ $t('DefaultWorkItem.skipDialogTitle') }}</span>
                <v-spacer></v-spacer>
                <v-btn icon variant="text" @click="closeSkipDialog">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <v-divider></v-divider>

            <v-card-text class="pt-4">
                <v-textarea
                    v-model="skipReason"
                    :label="$t('DefaultWorkItem.skipReason')"
                    variant="outlined"
                    density="compact"
                    rows="3"
                    auto-grow
                    :placeholder="$t('DefaultWorkItem.skipReasonPlaceholder')"
                />
            </v-card-text>

            <v-divider></v-divider>

            <v-card-actions class="pa-4">
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="closeSkipDialog">{{ $t('DefaultWorkItem.skipCancel') }}</v-btn>
                <v-btn
                    color="primary"
                    rounded
                    variant="flat"
                    :disabled="!canSubmitSkip"
                    :loading="isSkipping"
                    @click="submitSkip"
                >
                    {{ $t('DefaultWorkItem.skipSubmit') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import DefaultForm from '@/components/designer/DefaultForm.vue';

import Instruction from '@/components/ui/Instruction.vue';
import TaskReturnForm from '@/components/apps/todolist/TaskReturnForm.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        DefaultForm,
        Instruction,
        TaskReturnForm,
    },
    props: {
        definitionId: String,
        workItem: {
            type: Object,
            default: function () {
                return null;
            }
        },
        workItemStatus: {
            type: String,
            default: function () {
                return null;
            }
        },
        isDryRun: Boolean,
        dryRunWorkItem: Object,
        currentActivities: {
            type: Array,
            default: function () {
                return [];
            }
        },
        isSimulate: {
            type: String,
            default: "false"
        }
    },
    data: () => ({
        inputItems: null,
        outputItems: null,
        newMessage: '',
        claimButtonType: null, // 'claim', 'unclaim', null
        taskReturnDialog: false,
        // SKIP
        skipEligibility: null,
        isLoadingSkipEligibility: false,
        isSkipping: false,
        lastSkipEligibilityTaskId: null,
        skipDialog: false,
        skipReason: ''
    }),
    computed: {
        isAdmin(){
            return localStorage.getItem('isAdmin');
        },
        simulate() {
            return this.isSimulate === 'true' || this.isSimulate === 'false' ? this.isSimulate === 'true' : this.isSimulate;
        },
        isCompleted() {
            return this.workItemStatus == 'COMPLETED' || this.workItemStatus == 'DONE';
        },
        showButtonByStatus(){
            return this.workItemStatus != 'DELEGATED' 
        },
        mode() {
            return window.$mode;
        },
        showTaskReturnButton() {
            // 태스크 반송은 현재 uEngine 모드에서만 구현
            if (this.mode !== 'uEngine') return false;
            if (this.isDryRun) return false;
            if (this.isCompleted) return false;
            // 기존 버튼 노출 조건(위임상태 제외)을 그대로 따름
            if (!this.showButtonByStatus) return false;
            return true;
        },
        showTaskSkipButton() {
            // 현재 SKIP API는 uEngine 모드에만 구현되어 있음
            if (this.mode !== 'uEngine') return false;
            if (this.isDryRun) return false;
            if (this.isCompleted) return false;
            if (!this.showButtonByStatus) return false;
            return true;
        },
        taskIdForReturn() {
            return this.workItem?.worklist?.taskId ?? this.$route.params.taskId;
        },
        taskIdForSkip() {
            return this.workItem?.worklist?.taskId ?? this.$route.params.taskId;
        },
        taskSkipEnabled() {
            return this.skipEligibility?.enabled === true;
        },
        taskSkipTooltip() {
            if (this.isLoadingSkipEligibility) return this.$t('DefaultWorkItem.skipChecking');
            if (this.taskSkipEnabled) return this.$t('DefaultWorkItem.skipEnabledHelp');
            return this.skipEligibility?.reason || this.$t('DefaultWorkItem.skipDisabledRequired');
        },
        canSubmitSkip() {
            if (!this.taskSkipEnabled) return false;
            if (this.isSkipping) return false;
            if (!this.skipDialog) return false;
            return String(this.skipReason || '').trim().length > 0;
        },
        inputKeys() {
            const parameters = this.workItem && this.workItem.activity && this.workItem.activity.parameters ? this.workItem.activity.parameters : [];
            if (parameters.length > 0) {
                const inputs = parameters.filter(parameter => parameter.direction.includes("IN"));
                return inputs.map(input => input.argument.text);
            }
            return [];
        },
        outputKeys() {
            const parameters = this.workItem && this.workItem.activity && this.workItem.activity.parameters ? this.workItem.activity.parameters : [];
            if (parameters.length > 0) {
                const outputs = parameters.filter(parameter => parameter.direction.includes("OUT"));
                return outputs.map(output => output.argument.text);
            }
            return [];
        }
    },
    watch: {
        "$route.params.taskId": {
            handler(newVal, oldVal) {
                if (newVal && newVal != oldVal) {
                    this.init();
                    this.checkSkipAvailability();
                }
            },
        },
        'workItem': {
            handler() {
                this.checkClaimButton();
                this.checkSkipAvailability();
            },
            deep: true
        },
    },
    created() {
        this.init();
        this.checkClaimButton();
        this.checkSkipAvailability();
    },
    methods: {
        close() {
            this.$emit('close');
        },
        openTaskReturnDialog() {
            this.taskReturnDialog = true;
        },
        onTaskReturned() {
            // 반송 성공 시, 워크아이템 화면을 종료하고 인스턴스 목록으로 이동
            const route =
                window.$mode == 'ProcessGPT' ? btoa(this.workItem.worklist.instId) : this.workItem.worklist.instId;
            this.taskReturnDialog = false;
            this.$router.push(`/instancelist/${route}`);
        },
        init() {
            var me = this;
            let workitem = me.workItem;
            let parameterValues = workitem.parameterValues;
            if (me.isCompleted) {
                me.outputItems = parameterValues ? Object.entries(parameterValues).map(([key, value]) => ({ name: key, key, value })) : [];
            } else {
                me.inputItems = parameterValues ? Object.entries(parameterValues).map(([key, value]) => ({ name: key, key, value })) : [];
                if (me.inputKeys.length > 0) {
                    me.inputItems = me.inputItems.filter(item => me.inputKeys.includes(item.key));
                }
                
                if (me.outputKeys.length > 0) {
                    me.outputItems = parameterValues ? Object.entries(parameterValues).map(([key, value]) => ({ name: key, key, value })) : [];
                    me.outputItems = me.outputItems.filter(item => me.outputKeys.includes(item.key));
                }
            }
        },
        async checkSkipAvailability() {
            const me = this;
            if (!me.showTaskSkipButton) return;
            const taskId = String(me.taskIdForSkip || '');
            if (!taskId) return;
            if (me.lastSkipEligibilityTaskId === taskId && me.skipEligibility) return;

            me.lastSkipEligibilityTaskId = taskId;
            me.isLoadingSkipEligibility = true;
            // 기본 비활성(필수 업무). enabled=true 일 때만 활성화.
            me.skipEligibility = { enabled: false, reason: me.$t('DefaultWorkItem.skipDisabledRequired') };

            try {
                const res = await backend.getTaskSkipAvailability(taskId);
                me.skipEligibility = res || { enabled: false, reason: me.$t('DefaultWorkItem.skipDisabledRequired') };
            } catch (e) {
                // 초기 진입에서 실패해도 에러 UI는 띄우지 않고 기본 비활성 유지
                me.skipEligibility = { enabled: false, reason: me.$t('DefaultWorkItem.skipDisabledRequired') };
            } finally {
                me.isLoadingSkipEligibility = false;
            }
        },
        requestSkip() {
            const me = this;
            if (!me.taskSkipEnabled) return;
            const taskId = String(me.taskIdForSkip || '');
            if (!taskId) return;
            me.skipReason = '';
            me.skipDialog = true;
        },
        closeSkipDialog() {
            this.skipDialog = false;
        },
        submitSkip() {
            const me = this;
            if (!me.canSubmitSkip) return;
            const taskId = String(me.taskIdForSkip || '');
            if (!taskId) return;

            me.$try({
                context: me,
                action: async () => {
                    me.isSkipping = true;
                    try {
                        await backend.skipTask(taskId, { reason: String(me.skipReason || '').trim() });
                        me.skipDialog = false;
                        const route =
                            window.$mode == 'ProcessGPT' ? btoa(me.workItem.worklist.instId) : me.workItem.worklist.instId;
                        me.$router.push(`/instancelist/${route}`);
                    } finally {
                        me.isSkipping = false;
                    }
                },
                successMsg: this.$t('successMsg.taskSkipped')
            });
        },
        checkClaimButton(){
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if(me.isDryRun) return;
                    me.claimButtonType = null;
                    
                    if(me.mode == 'uEngine' && !me.isCompleted && me.workItem && me.workItem.activity && me.workItem.activity.role){
                        const roleName = me.workItem.activity.role.name;
                        const instanceId = me.workItem.worklist.instId;
                        const dispatchingOption = me.workItem.activity.role.dispatchingOption;
                        
                        // dispatchingOption이 1인 경우만 처리
                        if(dispatchingOption == 1){
                            const roleMapping = await backend.getRoleMapping(instanceId, roleName);
                            
                            // 선점하기 조건: roleMapping.endpoint == null
                            if(roleMapping.endpoint == null){
                                me.claimButtonType = 'claim';
                            }
                            // 선점해제 조건: roleMapping.endpoint != null
                            else if(roleMapping.endpoint != null){
                                me.claimButtonType = 'unclaim';
                            }
                        }
                    }
                }
            });
        },
        completeTask(value) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (me.isDryRun) {
                        let workItem = me.dryRunWorkItem;
                        if (workItem.execScope) value.execScope = workItem.execScope;

                        let processExecutionCommand = {
                            processDefinitionId: me.definitionId,
                            groups: window.localStorage.getItem('groups')
                        };

                        await backend.startAndComplete(
                            {
                                processExecutionCommand: processExecutionCommand,
                                workItem: value
                            },
                            me.isSimulate
                        );
                        me.close();
                    } else {
                        if (me.workItem.execScope) value.execScope = me.workItem.execScope;
                        await backend.putWorkItemComplete(me.$route.params.taskId, value, true);
                        const route = window.$mode == 'ProcessGPT' ? btoa(me.workItem.worklist.instId) : me.workItem.worklist.instId;
                        me.$router.push(`/instancelist/${route}`);
                    }
                },
                successMsg: this.$t('successMsg.workCompleted')
            });
        },
        executeProcess() {
            let value = { parameterValues: {} };
            let parameterValues = this.inputItems.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
            if (parameterValues) value.parameterValues = parameterValues;
            if (this.newMessage && this.newMessage.length > 0) {
                value.parameterValues['user_input_text'] = this.newMessage;
            }
            if (this.isDryRun && this.mode == 'ProcessGPT' || this.simulate) {
                this.$emit('executeProcess', value);
            } else {
                this.completeTask(value);
            }
        },
        intermediateSave() {
            var me = this;
            me.$try({
                context: me,
                action: () => {
                    if (me.inputItems && me.inputItems.length > 0) {
                        me.inputItems.forEach(async (variable) => {
                            await backend.setVariable(me.workItem.worklist.instId, variable.name, variable.value);
                        });
                    }
                },
                successMsg: this.$t('successMsg.intermediate')
            });
        },
        async assignTask() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    // 현재 사용자 ID 가져오기 (email 우선, 없으면 uid)
                    const currentUserId = localStorage.getItem('email') || localStorage.getItem('uid');
                    
                    if (!currentUserId) {
                        throw new Error('사용자 정보를 찾을 수 없습니다.');
                    }

                    if (!me.workItem || !me.workItem.worklist || !me.workItem.worklist.taskId) {
                        throw new Error('작업 항목 정보가 없습니다.');
                    }

                    // instanceId와 roleName 확인
                    if (!me.workItem.worklist.instId) {
                        throw new Error('인스턴스 ID가 없습니다.');
                    }
                    
                    // instance role mapping 업데이트
                    const instanceId = me.workItem.worklist.instId;
                    const roleName = me.workItem.activity.role.name
                    await backend.putRoleMapping(instanceId, roleName, {
                        endpoint: currentUserId
                    });

                    // workitem 업데이트
                    await backend.claimWorkItem(me.workItem.worklist.taskId,{
                        endpoint: currentUserId
                    });
                    
                    // 로컬 workItem 객체도 업데이트
                    if (me.workItem.worklist) {
                        me.workItem.worklist.endpoint = currentUserId;
                    }

                    // 부모 컴포넌트에 업데이트 알림
                    me.$emit('workItemUpdated', me.workItem);
                },
                successMsg: this.$t('DefaultWorkItem.getTaskSuccess') || '업무를 성공적으로 가져왔습니다.'
            });
        },
        async unAssignTask() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (!me.workItem || !me.workItem.worklist || !me.workItem.worklist.taskId) {
                        throw new Error('작업 항목 정보가 없습니다.');
                    }

                    // instanceId와 roleName 확인
                    if (!me.workItem.worklist.instId) {
                        throw new Error('인스턴스 ID가 없습니다.');
                    }
                    
                    const instanceId = me.workItem.worklist.instId;
                    const roleName = me.workItem.activity.role.name
                    
                    // POST /instance/{instanceId}/role-mapping/reviewer 호출
                    await backend.setRoleMapping(instanceId, roleName, {
                        endpoint: null
                    });
                    // workitem 업데이트
                    await backend.claimWorkItem(me.workItem.worklist.taskId,{
                        endpoint: null
                    });
                    
                    // 로컬 workItem 객체도 업데이트
                    if (me.workItem.worklist) {
                        me.workItem.worklist.endpoint = null;
                    }
                    
                    // 부모 컴포넌트에 업데이트 알림
                    me.$emit('workItemUpdated', me.workItem);
                },
                successMsg: this.$t('DefaultWorkItem.unAssignTaskSuccess') || '선점이 해제되었습니다.'
            });
        }
    }
};
</script>

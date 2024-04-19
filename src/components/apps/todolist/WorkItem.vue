<template>
     <v-card elevation="10" v-if="workItem" style="height:calc(100vh - 155px)">
        <v-card-title style="font-size: larger;"> {{workItem.activity.name}} </v-card-title>
        <v-row class="ma-0 pa-0">
             <!-- Left -->
            <v-col class="pa-4" cols="4">
                <div v-if="currentComponent">
                    <component :is="currentComponent" :work-item="workItem"></component>
                </div>
                <div v-else>
                    <div v-if="loading">Loading...</div>
                    <div v-else>
                        <div>No work item found</div>
                    </div>
                </div>
            </v-col>
             <!-- Right -->
            <v-col class="pa-4" cols="8">
                <div style="height: 50%; margin-bottom: 15px;" >
                    <v-card elevation="10">
                        프로세스 진행상태
                        <div>
                            <div v-if="bpmn">
                                <process-definition class="process-definition-resize"  :currentActivities="currentActivities" :bpmn="bpmn" :key="updatedKey" :isViewMode="true"></process-definition>
                            </div>
                            <dif v-else>
                                No BPMN found
                            </dif>
                        </div>
                    </v-card>
                </div>
                <div style="height: 50%;">
                    <v-row style="height: 100%; width: 100%; margin-left: 1px;">
                        <div style="width: 50%; height: 100%;">
                            <v-card elevation="10">
                                CheckPoint ({{checkedCount}}/{{ checkPoints ? checkPoints.length : 0 }})
                                <div style="width: 99%; height:70%; max-height:70%; overflow-y: scroll;">
                                    <div v-if="checkPoints" v-for="(checkPoint, index) in checkPoints" :key="index">
                                        <v-checkbox v-model="checkPoint.checked" :label="checkPoint.name" color="primary" hide-details></v-checkbox>
                                    </div>
                                    <div v-else>
                                        <v-checkbox disabled value-model="true" label="Check Point Description" color="primary" hide-details></v-checkbox>
                                    </div>
                                </div>
                            </v-card>
                            
                            <v-card elevation="10">
                                <div style="width: 99%; height: 23%;margin-top: 4%;">
                                    <v-row style="width: 100%; height: 100%; margin-left: 0%;">
                                        <div style="align-self: center; margin-left: 2%;">
                                            <v-avatar color="brown" size="large">
                                                <v-img src="https://avatars0.githubusercontent.com/u/9064066?v=4&s=460"></v-img>
                                            </v-avatar>
                                        </div>
                                        <v-col style="align-self: center;height: 100%;">
                                            <div> 다음 담당자 / 업무</div>
                                            <div> 홍길동 / 정보 수집 및 영상제작</div>
                                        </v-col>
                                    </v-row>
                                </div>
                            </v-card>
                            
                        </div>
                        <div style="width: 50%; height: 98%;">
                            <v-card elevation="10">
                                워크 히스토리
                                <perfect-scrollbar class="h-100" ref="scrollContainer" @scroll="handleScroll">
                                    <div class="d-flex w-100" style="height: calc(100vh - 300px);">
                                        <MessageLayout :messages="workHistoryMessages">
                                            <template v-slot:messageProfile="{ message }"><div></div></template>
                                        </MessageLayout>
                                    </div>
                                </perfect-scrollbar>
                            </v-card>
                        </div>
                    </v-row>
                </div>
            </v-col>
        </v-row>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import ProcessDefinition from '@/components/ProcessDefinition.vue';
import MessageLayout from "@/components/ui/MessageLayout.vue";
import DefaultWorkItem from './DefaultWorkItem.vue'; // DefaultWorkItem 컴포넌트 임포트
import FormWorkItem from './FormWorkItem.vue'; // FormWorkItem 컴포넌트 임포트


export default {
    components: {
        ProcessDefinition,
        MessageLayout,
        DefaultWorkItem,
        FormWorkItem
    },
    data: () => ({
        bpmn: null,
        workItem: null,
        checkPoints: null,
        workHistoryList: null,
        currentComponent: null,
        
        // status variables
        updatedKey: 0,
        loading: false,
    }),
    created() {
        this.init();
    },
    computed:{
        checkedCount(){
            if(!this.checkPoints) return 0
            return this.checkPoints.filter(checkPoint => checkPoint.checked).length;
        },
        workHistoryMessages(){
            if(!this.workHistoryList) return []
            return this.workHistoryList.map(workHistory => ({
                role: 'user',
                content: workHistory.title,
                description: 'TEST'
            }))
        },
        id() {
            if (this.$route.params.id) {
                return this.$route.params.id
            } else if (this.$route.query.id) {
                return this.$route.query.id
            } else {
                return null
            }
        },
    },
    methods: {
        async init() {
            var me = this
            const backend = BackendFactory.createBackend()
            me.loading = true;
            me.workItem = await backend.getWorkItem(this.id);
            me.bpmn = await backend.getRawDefinition(me.workItem.worklist.defId, {type: 'bpmn'});
            me.workHistoryList = await backend.getWorkListByInstId(me.workItem.worklist.instId);
            me.currentComponent = me.workItem.worklist.tool.includes('formHandler') ? 'FormWorkItem' : 'DefaultWorkItem';
            me.currentActivities = [me.workItem.activity.id];
            me.updatedKey ++
            me.loading = false
        },
    },
}
</script>
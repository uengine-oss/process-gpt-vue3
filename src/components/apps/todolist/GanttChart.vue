<template>
    <div class="overflow-y-auto" style="height: 100%;" v-if="!isLoading">

        <v-snackbar
            v-model="snackbar.show"
            class="custom-snackbar"
            :timeout="3000"
            :color="snackbar.color"
            elevation="24"
            location="top"
        > {{ snackbar.text }}
            <v-btn v-if="snackbar.detail" variant="plain" @click="snackbar.showDetail = !snackbar.showDetail">
                {{ $t('App.view') }}
            </v-btn>
            <v-expand-transition>
                <div v-if="snackbar.detail && snackbar.showDetail" style="text-align: left;">{{ snackbar.detail }}</div>
            </v-expand-transition>
            <template v-slot:actions>
                <v-btn color="pink" variant="text" @click="snackbar = false">x</v-btn>
            </template>
        </v-snackbar>

        <div class="gantt-container">
            <Gantt 
                ref="ganttRef"
                :tasks="tasks" 
                :dependencies="dependencies"
                :users="users" 
                
                @task-clicked="handleTaskClicked"
                @task-updated="handleTaskUpdated" 
                @task-added="handleTaskAdded"
                
                @link-clicked="handleLinkClicked"
                @link-event="handleLinkEvent"
                
                @message="handleMessage"
            />

            <div class="gantt-detail-overlay" v-if="editItem">
                <v-card flat dense>
                    <!-- 상세 정보 -->
                    <v-card-actions style="justify-content: flex-end;">
                        <Icons v-if="type === 'task'" :icon="'tab-move'" :size="20" @click="moveDetail()" />
                        <Icons v-if="editItem.adhoc" :icon="'trash'" :size="20" @click="deleteDetail()"/>
                        <Icons :icon="'close'" :size="16" @click="closeDetail()"/>
                    </v-card-actions>
                    <v-card-text v-if="type === 'task'">
                        <v-col>
                            <!-- 상단 요약 -->
                            <div class="issue-header">
                                <div class="issue-title">{{ editItem.name }}</div>
                                <v-chip color="primary" class="ml-2">{{ editItem.status }}</v-chip>
                            </div>
                            <div class="issue-desc mt-2">
                                <div class="issue-title">설명</div>
                                {{ editItem.description }}
                            </div>

                            <!-- 하위 업무 항목 -->
                            <div class="issue-desc mt-2">
                                <div class="issue-title">하위 업무 항목</div>
                                <v-progress-linear value="0" height="8" class="mb-2"></v-progress-linear>
                            </div>

                            <!-- 연결된 업무 항목 -->
                            <div class="issue-desc mt-2">
                                <div class="issue-title">연결된 업무 항목</div>
                            </div>


                            <!-- 세부 사항 -->
                            <div class="issue-desc mt-2">
                                <div class="issue-title">세부 사항</div>
                                <div class="issue-desc">
                                    <v-col>
                                        <div class="issue-title">
                                            담당자
                                        </div>
                                        <div class="issue-desc">
                                            {{ editItem.participants }}
                                        </div>
                                    </v-col>
                                </div>
                            </div>
                        </v-col>
                    </v-card-text>
                    <v-card-text v-if="type === 'link'">
                        <div>
                            {{ editItem.source.id }}
                            {{ editItem.source.name }}
                        </div>

                        <div>
                            {{ editItem.target.id }}
                            {{ editItem.target.name }}
                        </div>
                    </v-card-text>
                   
                </v-card>
            </div>
        </div>
    </div>
</template>

<script>
import Gantt from '@/components/Gantt.vue';

export default {
    components: {
        Gantt
    },
    props: {
        instance: Object,
        tasks: Array,
        dependencies: Array,
        users: Array
    },
    data: () => ({
        snackbar: {
            show: false,
            color: 'success',
            text: '',
            showDetail: false,
            detail: ''
        },
        type: 'task',
        editItem: null,

    }),
    methods: {
        handleMessage(value){
           this.snackbar.show = true
           this.snackbar.color = value.color
           this.snackbar.text = value.text
           this.snackbar.detail = value.detail
        },
        handleTaskUpdated(task){
            this.$emit('task-updated', task);
        },
        handleTaskAdded(task){
            this.$emit('task-added', task);
        },
        handleTaskClicked(task){
            this.type = 'task'
            this.editItem = task;
            this.$emit('task-clicked', task);
        },
        handleLinkClicked(link, source, target){
            this.type = 'link'
            this.editItem = {
                link: link,
                source: source,
                target: target
            }
            this.$emit('link-clicked', link, source, target);
        },
        handleLinkEvent(event){
            this.$emit('link-event', event);
        },
        closeDetail(){
            this.editItem = null
        },
        moveDetail(){
            this.$router.push(`/todolist/${this.editItem.taskId}`)
            // this.$emit('')
        },
        deleteDetail(){
            const ganttRef = this.$refs.ganttRef;
            console.log(ganttRef.deleteTaskById());

        }
    }
};
</script>

<style>
.g-upper-timeunit {
    font-size: 20px;
    font-weight: 500;
}

.g-timeunit {
    font-size: 16px;
    font-weight: 500;
}

.dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}
.dialog-box {
    background: #fff;
    padding: 24px;
    border-radius: 8px;
    min-width: 320px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.gantt-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.gantt-detail-overlay {
  position: absolute; /* 또는 fixed */
  top: 0;
  right: 0;
  width: 400px; /* 패널 너비 */
  height: 100%;
  background: #fff;
  box-shadow: -2px 0 8px rgba(0,0,0,0.08);
  z-index: 100;
  border-left: 1px solid #eee;
  overflow-y: auto;
  transition: transform 0.2s;
}
.issue-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.2em;
}
.issue-key {
  font-weight: bold;
  color: #8e24aa;
}
.issue-title {
  font-size: 1.3em;
  font-weight: 600;
}
.issue-desc {
  color: #444;
}
</style>


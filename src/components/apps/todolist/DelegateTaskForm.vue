<template>
    <div>
        <v-card>
            <v-row class="ma-0 pa-4 pb-0 align-center">
                <v-card-title class="pa-0">
                   {{ $t('DelegateTask.title') }}
                </v-card-title>
                <v-spacer></v-spacer>
                <v-btn @click="close()"
                    class="ml-auto" 
                    variant="text" 
                    density="compact"
                    icon
                >
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-row>
            <v-card-text class="pa-4 pb-0">
                <v-card>
                    <v-card-title>
                        <v-row style="margin: 0px; place-content: space-between;">
                            <div>
                                {{name}}
                                <StatusChip :status="status" size="x-small" type="task"/>
                            </div>
                            <div>
                                <v-chip v-if="!adhoc && defId"
                                    color="primary"
                                    size="small" variant="outlined"
                                    density="comfortable">BPM</v-chip>
                            </div>
                        </v-row>
                    </v-card-title>
                    <v-card-text style="padding-bottom: 5px;">
                        <p>{{ $t('DelegateTask.description') }}: {{ description }}</p>
                        <p>{{ $t('DelegateTask.endDate') }}: {{ dueDate }}</p>
                        <p>{{ $t('DelegateTask.startDate') }}: {{ startDate }}</p>
                        <p>{{ $t('DelegateTask.assignee') }}</p>    
                        <div v-if="isLoading">
                            <v-skeleton type="list-item-two-line" height="48"></v-skeleton>
                        </div>
                        <div v-else>
                            <div v-if="assigneeUserInfo.length == 0">
                                {{ $t('DelegateTask.notification') }}
                            </div>
                            <div v-else>
                                <div v-for="user in assigneeUserInfo">
                                    <v-col cols="9">
                                        <div class="d-flex align-center">
                                            <div class="pl-5">
                                                <v-img v-if="user.profile" :src="user.profile" width="45px" 
                                                    class="rounded-circle img-fluid" />
                                                <v-avatar v-else>
                                                    <Icons :icon="'user-circle-bold'" :size="50" />
                                                </v-avatar>
                                            </div>
                                            <div class="ml-5">
                                                <h4 class="text-subtitle-1 font-weight-semibold text-no-wrap">{{ user.username }}</h4>
                                                <div class="text-subtitle-1 textSecondary text-no-wrap mt-1">{{ user.email }}</div>
                                            </div>
                                        </div>
                                    </v-col>
                                </div>
                            </div>
                        </div>
                    </v-card-text>
                </v-card>
                <v-icon size="48" color="primary" class="mx-auto d-block">mdi-arrow-down-bold</v-icon>
                <v-card>
                    <v-card-title  v-if="delegateUser">{{ $t('DelegateTask.delegateTitle') }}</v-card-title>
                    <v-card-text v-if="delegateUser" style="padding-bottom: 5px;">
                        <v-col cols="9">
                            <div class="d-flex align-center">
                                <div class="pl-5">
                                    <v-img v-if="delegateUser.profile" :src="delegateUser.profile" width="45px" 
                                        class="rounded-circle img-fluid" />
                                    <v-avatar v-else>
                                        <Icons :icon="'user-circle-bold'" :size="50" />
                                    </v-avatar>
                                </div>
                                <div class="ml-5">
                                    <h4 class="text-subtitle-1 font-weight-semibold text-no-wrap">{{ delegateUser.username }}</h4>
                                    <div class="text-subtitle-1 textSecondary text-no-wrap mt-1">{{ delegateUser.email }}</div>
                                </div>
                            </div>
                        </v-col>
                        <v-divider></v-divider>
                    </v-card-text>
                    <v-card-text>
                        <UserListPage :config="{itemsPerPage: 1, height: 200}" @selected-user="selectedUser"></UserListPage>
                    </v-card-text>
                </v-card>
            </v-card-text>
            <v-row class="ma-0 pa-4 pr-2">
                <v-spacer></v-spacer>
                <div v-if="message" style="margin-right: 7px; font-size: small;">{{message}}</div>
                <v-btn @click="delegate()"
                    color="primary"
                    variant="elevated" 
                    class="rounded-pill"
                    density="compact"
                    :disabled="isDisabled"
                >{{ $t('DelegateTask.delegate') }}</v-btn>
              
            </v-row>
        </v-card>
    </div>
</template>
<script>
import StatusChip from '@/components/ui/common/StatusChip.vue'
import UserListPage from '@/components/ui/list-pages/UserListPage.vue'

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();
export default {
    name: 'DelegateTaskForm',
    components: {
        StatusChip,
        UserListPage
    },
    props:{
        task: Object
    },
    data() {
        return {
            isLoading: true,
            assigneeUserInfo: null,
            delegateUser: null,

        }
    },
    computed: {
        name(){
            if(!this.task) return '';
            return this.task.activity.name;
        },
        description(){
            if(!this.task) return '';
            return this.task.worklist.description;
        },
        status(){
            if(!this.task) return '';
            return this.task.worklist.status;
        },
        adhoc(){
            if(!this.task) return '';
            return this.task.worklist.adhoc;
        },
        endpoint(){
            if(!this.task) return '';
            return this.task.worklist.endpoint;
        },
        startDate(){
            if(!this.task) return '';
            return this.task.worklist.startDate
        },
        dueDate(){
            if(!this.task) return '';
            return this.task.worklist.dueDate
        },
        defId(){
            if(!this.task) return '';
            return this.task.worklist.defId
        },
        isDisabled(){
            if(!this.delegateUser) return true
            if(!this.task.worklist.endpoint) return true
            if(this.delegateUser.email == this.task.worklist.endpoint) return true

            return false
        },
        message(){
            if(!this.delegateUser) {
                return this.$t('DelegateTask.selectAssignee')
            }
            if(this.delegateUser.email == this.task.worklist.endpoint) {
                return this.$t('DelegateTask.equalDelegate')
            }
            return null
        },
    },
    created() {
        var me = this
        me.$try({
            action: async () => {
                me.isLoading = true
                me.assigneeUserInfo = await backend.getUserList({
                    orderBy: 'email',
                    startAt: me.task.worklist.endpoint,
                    endAt: me.task.worklist.endpoint
                })
                me.isLoading = false
            }
        })  
    },
    methods: {
        selectedUser(user){
            this.delegateUser = user
        },
        delegate(){
            this.$emit('delegate', this.delegateUser, this.assigneeUserInfo);
        },
        close(){
            this.$emit('close');
        }
    }
}
</script>
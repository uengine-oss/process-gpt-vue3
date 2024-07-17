<template>
    <v-card elevation="10" v-if="instance" style="height: calc(100vh - 155px); ">
        <div class="d-flex">
            <div class="px-3 py-3 pb-2 align-center">
                <div class="d-flex">
                    <h5 class="text-h5 font-weight-semibold">
                        {{ instance.name }}
                    </h5>

                    <v-chip v-if="instance.status" size="x-small" variant="outlined"
                        style="margin: 2px 0px 0px 5px !important; display: flex; align-items: center">
                        {{ instance.status }}
                    </v-chip>
                    <div v-for="event in eventList">
                        <v-btn @click="fireMessage(event)"> {{ event }} 보내기 </v-btn>
                    </div>
                </div>
                <div v-if="instance.instanceId" class="font-weight-medium" style="color:gray; font-size:14px;">
                    ID: {{ instance.instanceId }}
                </div>
            </div>
            <v-btn v-if="deletable" @click="deleteInstance" variant="plain" icon class="ml-auto">
                <Icons :icon="'trash'" :color="'black'"/>
            </v-btn>
        </div>

        <div style="height: 100%;">
            <v-tabs v-model="tab" bg-color="transparent" height="40" color="primary">
                <v-tab v-for="tabItem in tabItems" :key="tabItem.value" :value="tabItem.value">
                    {{ tabItem.label }}
                </v-tab>
            </v-tabs>
            <v-divider></v-divider>
            <v-card-text style="height: 100%;" class="pa-0">
                <v-window style="height: 100%;" v-model="tab">
                    <v-window-item style="height: 100%;" v-for="tabItem in tabItems" :key="tabItem.value" :value="tabItem.value">
                        <component :is="tabItem.component" :instance="instance" />
                    </v-window-item>
                </v-window>
            </v-card-text>
        </div>
    </v-card>
    <v-card v-else>
        <!-- 존재 하지 않은 인스턴스 -->
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

import InstanceProgress from './InstanceProgress.vue';
import InstanceTodo from './InstanceTodo.vue';
import InstanceWorkHistory from './InstanceWorkHistory.vue';

export default {
    components: {
        InstanceProgress,
        InstanceTodo,
        InstanceWorkHistory,
    },
    data: () => ({
        instance: null,
        eventList: [],
        // tab
        tab: "progress",
        tabItems: [
            { value: 'progress', label: '진행 상황', component: 'InstanceProgress' },
            { value: 'todo', label: '워크 아이템', component: 'InstanceTodo' },
            { value: 'workhistory', label: '워크 히스토리', component: 'InstanceWorkHistory' }
        ]
    }),
    watch: {
        $route: {
            deep: true,
            async handler(newVal, oldVal) {
                if (newVal.params.instId && newVal.params.instId !== oldVal.params.instId) {
                    await this.init();
                }
            }
        },
        async tab(newVal, oldVal) {
            if (newVal !== oldVal) {
                await this.init();
            }
        }
    },
    created() {
        this.init();
    },
    computed: {
        id() {
            return atob(this.$route.params.instId);
        },
        isCompleted() {
            return this.instance.status == "COMPLETED"
        },
        deletable() {
            if (this.instance) {
                const email = localStorage.getItem('email');
                if (this.instance.current_user_ids && this.instance.current_user_ids.length > 0 && this.instance.current_user_ids.includes(email)) {
                    return true;
                }
            }
            return false;
        }
    },
    methods: {
        init() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (!me.id) return;
                    me.instance = await backend.getInstance(me.id);
                    if (me.instance) {
                        me.eventList = await backend.getEventList(me.instance.instanceId);
                    }
                }
            });
        },
        delay(time) {
            return new Promise((resolve) => setTimeout(resolve, time));
        },
        fireMessage(event) {
            backend.fireMessage(this.instance.instanceId, event);
        },
        deleteInstance() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (!me.id) return;
                    await backend.deleteInstance(me.id);
                    me.EventBus.emit('instances-updated');
                    me.$router.push("/todolist");
                },
                successMsg: '인스턴스가 삭제되었습니다.',
            });
        }
    }
};
</script>

<style>
.work-itme-current-component .v-checkbox .v-input__details {
    display: none;
}
.work-itme-current-component .v-checkbox {
    height: 40px;
}
.work-itme-current-component .v-checkbox label {
    opacity: 0.6 !important;
}
.work-itme-current-component .form-checkbox-label {
    font-size: 20px;
    font-weight: 500;
}
.work-itme-current-component .form-radio-box {
    margin-top: 25px;
}
.work-itme-current-component .form-radio-box .v-radio-group {
    margin-top: 8px;
}
.work-itme-current-component .form-radio-box .form-radio-label {
    font-size: 20px;
    font-weight: 500;
}

.work-itme-current-component .form-label {
    font-size: 20px;
    font-weight: 500;
}
</style>

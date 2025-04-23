<template>
    <v-card elevation="10" v-if="instance" style="height: calc(100vh - 143px); ">
        <v-progress-linear v-if="workitemRunning" indeterminate color="primary" />
        <div class="d-flex">
            <div class="px-3 py-3 pb-2 pl-4 align-center">
                <div class="d-flex">
                    <h5 class="text-h5 font-weight-semibold">
                        {{ instance.name }}
                    </h5>

                    <v-chip v-if="instance.status" size="x-small" variant="outlined"
                        style="margin: 2px 0px 0px 5px !important; display: flex; align-items: center">
                        {{ instance.status }}
                    </v-chip>
                    <div v-for="event in eventList" :key="event.tracingTag">
                        <v-btn @click="fireMessage(event)"
                            color="primary"
                            rounded
                            style="font-size:12px;"
                            density="comfortable"
                            class="ml-3"
                        > {{  $t('InstanceCard.sendEvent', {event: event.name ? event.name : event.type}) }}
                        </v-btn>
                    </div>
                </div>
                <div v-if="instance.instanceId" class="font-weight-medium" style="color:gray; font-size:14px;">
                    ID: {{ instance.instanceId }}
                </div>
            </div>
            <v-btn v-if="deletable" @click="deleteInstance" variant="plain" icon class="ml-auto">
                <Icons :icon="'trash'" />
            </v-btn>
        </div>

        <div style="height: 100%;">
            <v-tabs v-model="tab" bg-color="transparent" height="40" color="primary">
                <v-tab v-for="tabItem in tabItems" :key="tabItem.value" :value="tabItem.value">
                    {{ $t(tabItem.label) }}
                </v-tab>
            </v-tabs>
            <v-divider></v-divider>
            <v-card-text style="height: calc(100vh - 260px);" class="pa-0">
                <v-window style="height: 100%;" v-model="tab">
                    <v-window-item style="height: 100%;" v-for="tabItem in tabItems" :key="tabItem.value" :value="tabItem.value">
                        <component :is="tabItem.component" :instance="instance" :ref="tabItem.value" />
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
import InstanceGantt from './InstanceGantt.vue';

export default {
    components: {
        InstanceProgress,
        InstanceTodo,
        InstanceWorkHistory,
        InstanceGantt
    },
    data: () => ({
        instance: null,
        eventList: [],
        // tab
        tab: "progress",
        tabItems: [
            { value: 'progress', label: 'InstanceCard.progress', component: 'InstanceProgress' },
            { value: 'todo', label: 'InstanceCard.workItem', component: 'InstanceTodo' },
            { value: 'workhistory', label: 'InstanceCard.workHistory', component: 'InstanceWorkHistory' },
            { value: 'gantt', label: 'InstanceCard.ganttChart', component: 'InstanceGantt' }
        ],
        workitemRunning: false
    }),
    watch: {
        $route: {
            deep: true,
            async handler(newVal, oldVal) {
                if (newVal.params.instId && newVal.params.instId !== oldVal.params.instId) {
                    this.tab = "progress";
                    await this.init();
                }
            }
        },
        async tab(newVal, oldVal) {
            if (newVal !== oldVal) {
                const activeComponents = this.$refs[newVal];
                if (activeComponents && activeComponents.length > 0 && activeComponents[0].init) {
                    await activeComponents[0].init();
                }
            }
        }
    },
    created() {
        this.init();
    },
    mounted() {
        if (this.$route.query.workitemRunning === 'true' && this.id == this.$route.query.instId) {
            this.workitemRunning = true;
        }
        
        this.EventBus.on('workitem-running', (instId) => {
            if (this.id == instId) {
                this.workitemRunning = true;
            }
        });

        this.EventBus.on('workitem-completed', async () => {
            this.workitemRunning = false;
            if (Object.keys(this.$route.query).length > 0) {
                this.$router.replace({ query: null });  
            }
            await this.init();
        });
    },
    computed: {
        id() {
            if ($mode == "ProcessGPT") {
                return decodeURIComponent(atob(this.$route.params.instId))
            } else {
                return this.$route.params.instId
            }
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
                    const activeComponents = me.$refs[me.tab];
                    if (activeComponents && activeComponents.length > 0 && activeComponents[0].init) {
                        await activeComponents[0].init();
                    }
                }
            });
        },
        delay(time) {
            return new Promise((resolve) => setTimeout(resolve, time));
        },
        async fireMessage(event) {
            await backend.fireMessage(this.instance.instanceId, event);
            this.init();
            const progressComponent = this.$refs.progress[0];
            if (progressComponent) {
                progressComponent.initStatus();
            }
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
                successMsg: this.$t('successMsg.instanceDelete')
            });
        },
    }
};
</script>

<style>
</style>

<template>
    <v-card elevation="10" v-if="instance" style="height: calc(100vh - 155px)">
        <div class="px-3 pt-3 pb-2 d-flex align-center">
            <h5 class="text-h5 font-weight-semibold">
                {{ instance.name }} (ID: {{ instance.instanceId }})
            </h5>

            <v-chip v-if="instance.status" size="x-small" variant="outlined"
                style="margin: 2px 0px 0px 5px !important; display: flex; align-items: center">
                {{ instance.status }}
            </v-chip>
            <div v-for="event in eventList">
                <v-btn @click="fireMessage(event)"> {{ event }} 보내기 </v-btn>
            </div>
        </div>

        <v-card flat>
            <v-tabs v-model="tab" bg-color="transparent" height="50" color="primary">
                <v-tab value="progress">
                    진행 상황
                </v-tab>
                <v-tab value="todo">
                    워크아이템
                </v-tab>
            </v-tabs>
            <v-divider></v-divider>
            <v-card-text class="pa-0">
                <v-window v-model="tab">
                    <v-window-item value="progress">
                        <InstanceProgress :instance="instance" />
                    </v-window-item>
                    <v-window-item value="todo">
                        <InstanceTodo :instance="instance" />
                    </v-window-item>
                </v-window>
            </v-card-text>
        </v-card>
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

export default {
    components: {
        InstanceProgress,
        InstanceTodo,
    },
    data: () => ({
        instance: null,
        eventList: [],
        // tab
        tab: "progress",
    }),
    watch: {
        $route: {
            deep: true,
            async handler(newVal, oldVal) {
                if (newVal.params.instId && newVal.params.instId !== oldVal.params.instId) {
                    await this.init();
                }
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
        isComplete(){
            return this.instance.status == "COMPLETED"
        },
    },
    methods: {
        init() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (!me.id) return;
                    me.instance = await backend.getInstance(me.id);
                    me.eventList = await backend.getEventList(me.instance.instanceId);
                    me.tab = "progress";
                }
            });
        },
        delay(time) {
            return new Promise((resolve) => setTimeout(resolve, time));
        },
        fireMessage(event) {
            backend.fireMessage(this.instance.instanceId, event);
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

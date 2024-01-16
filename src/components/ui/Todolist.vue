<script>
import { defineComponent } from 'vue';

import CommonStorageBase from "@/components/storage/CommonStorageBase";

export default defineComponent({
    data: () => ({
        storage: null,
        todolist: [],
        userInfo: {},
        path: 'todolist',
    }),
    async created() {
        this.storage = await new CommonStorageBase(this);
        this.init();
    }, 
    methods:{
        async init() {
            if (this.path) {
                this.userInfo = await this.storage.getUserInfo();
                this.getTodolist();
            }
        },
        async getTodolist() {
            await this.storage.watch(`db://${this.path}/${this.userInfo.email}`, (callback) => {
                if (callback) {
                    this.todolist = Object.values(callback);
                }
            });
        },
        goInstance(id) {
            this.$router.push(`/instances/${id}`);
        },
        async deleteItem(id) {
            if (confirm("해당 Item 을 삭제 하시겠습니까?")) {
                const path = `db://${this.path}/${this.userInfo.email}`;
                if (id) {
                    await this.storage.delete(`${path}/${id}`);
                    await this.init();
                }
            }
        },
    },
});
</script>

<template>
    <v-card class="border" elevation="0">
        <div class="border-table">
            <v-table class="month-table">
                <thead>
                    <tr>
                        <th class="text-subtitle-1 font-weight-semibold">인스턴스</th>
                        <th class="text-subtitle-1 font-weight-semibold">액티비티</th>
                        <th class="text-subtitle-1 font-weight-semibold">프로세스</th>
                        <!-- <th class="text-subtitle-1 font-weight-semibold">Team</th> -->
                        <th class="text-subtitle-1 font-weight-semibold">담당자</th>
                        <th class="text-subtitle-1 font-weight-semibold">시작일</th>
                        <th class="text-subtitle-1 font-weight-semibold">완료일</th>
                        <th class="text-subtitle-1 font-weight-semibold">상태</th>
                        <th class="text-subtitle-1 font-weight-semibold"></th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in todolist" :key="item.instanceId" class="month-item">
                        <td>
                            <h6 class="text-subtitle-1 text-grey100 font-weight-medium text-no-wrap">
                                {{ item.instanceId }}
                            </h6>
                        </td>
                        <td>
                            <h6 class="text-subtitle-1 text-grey100 font-weight-medium text-no-wrap">
                                {{ item.activityId }}
                            </h6>
                        </td>
                        <td>
                            <h6 class="text-subtitle-1 text-grey100 font-weight-medium text-no-wrap">
                                {{ item.definitionId }}
                            </h6>
                        </td>
                        <td>
                            <h6 class="text-subtitle-1 text-grey100 font-weight-medium text-no-wrap">
                                {{ item.userId }}
                            </h6>
                        </td>
                        <td>
                            <h6 class="text-subtitle-1 text-grey100 font-weight-medium text-no-wrap">
                                {{ item.startDate }}
                            </h6>
                        </td>
                        <td>
                            <h6 class="text-subtitle-1 text-grey100 font-weight-medium text-no-wrap">
                                {{ item.endDate }}
                            </h6>
                        </td>
                        <!-- <td>
                            <div class="d-flex align-center">
                                <div class="ml-2 d-flex flex-row-reverse">
                                    <v-avatar v-for="team in item.teams" :key="team.id" size="35"
                                        :class="'ml-n2 avtar-border bg-' + team.color">
                                        {{ team.text }}
                                    </v-avatar>
                                </div>
                            </div>
                        </td> -->
                        <td>
                            <v-chip rounded="pill" 
                                    class="font-weight-bold" 
                                    :color="item.status =='Running' ? 'warning' : 'success'" 
                                    size="small" 
                                    label
                            >
                                {{ item.status }}
                            </v-chip>
                        </td>
                        <td>
                            <h6 class="text-h6">{{ item.budget }}</h6>
                        </td>
                    </tr>
                </tbody>
            </v-table>
        </div>
    </v-card>
</template>

<template>
    <v-data-table items-per-page="5" 
            :headers="headers"
            :items="todolist" 
            item-value="name"
            class="border rounded-md"
    ></v-data-table>
</template>

<script>
import { defineComponent } from "vue";
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
auth.storage.loginUser();

export default defineComponent({
    data: () => ({
        todolist: [],
        userInfo: {},
        path: 'todolist',
        headers: [
            { title: '인스턴스', align: 'start', key: 'instanceId' },
            { title: '액티비티', align: 'start', key: 'activityId' },
            { title: '프로세스', align: 'start', key: 'definitionId' },
            { title: '시작일', align: 'start', key: 'startDate' },
            { title: '완료일', align: 'start', key: 'endDate' },
            // { title: '마감일', align: 'start', key: 'dueDate' },
            { title: '담당자', align: 'start', key: 'userId' },
            { title: '상태', align: 'start', key: 'status' },
        ]
    }),
    async created() {
        this.init();
    }, 
    methods:{
        async init() {
            if (this.path) {
                this.userInfo = await auth.storage.getUserInfo();
                this.getTodolist();
            }
        },
        async getTodolist() {
            await auth.storage.watch(`db://${this.path}/${this.userInfo.email}`, (callback) => {
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
                    await auth.storage.delete(`${path}/${id}`);
                    await this.init();
                }
            }
        },
    },
});
</script>
<template>
    <v-row>
        <v-col v-for="(item, index) in todoList" :key="index" cols="12" sm="4"
            style="height:190px;"
        >
            <v-card elevation="10" color="primary" >
                <v-card-text style="padding:15px;">
                    <img :src="item.img" alt="shape" class="shape">
                    <Icon :icon="item.icon" width="30" height="30" class="mb-6"/>
                    <div class="text-h1 font-weight-semibold mb-2 text-white">{{ item.number }}</div>
                    <v-row class="ma-0 pa-0">
                        <p class="text-subtitle-1 opacity-50 font-weight-medium">{{ $t(item.name) }}</p>
                        <v-spacer></v-spacer>
                        <v-btn @click="goToTodoList()"
                            icon text width="24" height="24"
                            color="primary"
                        >
                            <Icon icon="material-symbols:tab-move" width="20" height="20" />
                        </v-btn>
                    </v-row>
                </v-card-text>
            </v-card>
        </v-col>
    </v-row>
</template>
<script>
import StorageBase from '@/utils/StorageBase';
import shape1 from '@/assets/images/svgs/warning-shap.svg';
import shape2 from '@/assets/images/svgs/danger-shap.svg';
import shape3 from '@/assets/images/svgs/info-shap.svg';

export default {
    data() {
        return {
            todoList: [
                {
                    name: 'DashboardTodoList.todo',
                    number: "4",
                    img: shape1,
                    icon: "icons8:todo-list"
                },
                {
                    name: 'DashboardTodoList.inProgress',
                    number: "2",
                    img: shape2,
                    icon: "carbon:in-progress"
                },
                {
                    name: 'DashboardTodoList.done',
                    number: "23",
                    img: shape3,
                    icon: "lets-icons:done-ring-round"
                }
            ]
        }
    },
    created() {
    },
    methods: {
        goToTodoList() {
            this.$router.push('/todolist');
        }
    }
};
</script>

<style scoped>
.shape {
    position: absolute;
    right: 0;
    top: 0px;
}
</style>
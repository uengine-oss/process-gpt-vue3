<template>
    <v-row>
      <v-col v-for="(item, index) in todoList" :key="index" cols="12" sm="4" style="height:190px;">
        <v-card elevation="10" color="primary">
          <v-card-text style="padding:15px;">
            <img :src="item.img" alt="shape" class="shape">
            <Icon :icon="item.icon" width="30" height="30" class="mb-6"/>
            <div class="text-h1 font-weight-semibold mb-2 text-white">{{ item.count }}</div>
            <v-row class="ma-0 pa-0">
              <p class="text-subtitle-1 opacity-50 font-weight-medium">{{ $t(item.name) }}</p>
              <v-spacer></v-spacer>
              <v-btn @click="goToTodoList" icon text width="24" height="24" color="primary">
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
            count: 0,
            img: shape1,
            icon: "icons8:todo-list",
            status: "TODO"
          },
          {
            name: 'DashboardTodoList.inProgress',
            count: 0,
            img: shape2,
            icon: "carbon:in-progress",
            status: "IN_PROGRESS"
          },
          {
            name: 'DashboardTodoList.done',
            count: 0,
            img: shape3,
            icon: "lets-icons:done-ring-round",
            status: "DONE"
          }
        ]
      }
    },
    async created() {
        const storage = await StorageBase.getStorage("supabase");
        let userId = localStorage.getItem('email');
        if (!userId) {
            const loginUserInfo = await storage?.getUserInfo();
            userId = loginUserInfo.email;
        }
        for (let item of this.todoList) {
            const options = {
                match: {
                    status: item.status,
                    user_id: userId
                }
            };
            // getCount 함수를 호출하여 개수를 조회
            const todoCount = await storage.getCount("todolist", options); // result 변수명을 todoCount로 변경

            // 조회 결과에서 에러가 없다면, 해당 개수를 item.count에 할당
            if (todoCount && !todoCount.error) {
                item.count = todoCount; // 조회된 개수를 할당
            } else {
                // 에러 처리: 콘솔에 에러 메시지를 출력
                console.error(`Error fetching count for ${item.status}`, todoCount.error); // result.error를 todoCount.error로 변경
                item.count = 0; // 에러가 발생한 경우, count를 0으로 설정
            }
        }
        // 데이터 업데이트 후 Vue 인스턴스의 상태를 갱신하기 위해 반응형 데이터를 업데이트
        this.todoList = [...this.todoList];
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
  
<template>
    <v-card elevation="10" :class="'bg-' + column.cardbg">
        <div class="d-flex align-center justify-space-between pa-3 pb-2 pt-2">
            <h6 class="text-h6 font-weight-semibold">{{ $t(column.title) }}</h6>
        </div>
           
        <div ref="section" class="pa-3 todo-list-card-box" :style="{ height: 'calc(100vh - 240px)' }"
            style="overflow:auto;">
            <draggable class="dragArea list-group cursor-move" 
                :list="column.tasks"
                :animation="200" 
                ghost-class="ghost-card" 
                group="tasks" 
                @add="updateTask"
                :move="checkDraggable">
                    <transition-group>
                        <div v-for="task in column.tasks" :key="task.id" class="cursor-move todo-task-item-card-style">
                            <KanbanColumnCard :task="task" @deleteTask="deleteTask" @executeTask="executeTask" :userInfo="userInfo" />
                        </div>
                    </transition-group>
            </draggable>
        </div>
    </v-card>
</template>

<script>
import BackendFactory from "@/components/api/BackendFactory";
const backend = BackendFactory.createBackend();
import KanbanColumnCard from "./KanbanColumnCard.vue";

export default {
    components: {
        KanbanColumnCard
    },
    props: {
        column: Object,
       
    },
    data: () => ({
        
    }),
    async mounted() {
        
    },
    methods: {
        
    }
}
</script>
<style>
    .todo-task-item-card-style:not(:first-of-type) {
        margin-top:8px;
    }
    .todo-list-card-box > div {
        width:100%;
        height:100%;
    }
    .todo-task-fold-btn {
        cursor: pointer;
        display: none;
    }
    @media (max-width: 959px) {
        .todo-task-unfold-btn,
        .todo-task-fold-btn {
            display: block;
        }
    }

</style>
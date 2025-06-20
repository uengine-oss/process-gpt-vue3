<template>
    <div elevation="10">
        <v-row class="ma-0 pa-0 todo-task-column-box-pc">
            <v-col v-for="column in columns" :key="column.id"
                class="pa-2 kanban-column"
                :cols="columnCols"
            >
                <KanbanColumn 
                    :column="column" 
                    :loading="loading" 
                    :isNotAll="false"
                    :showAddButton="false"
                    :users="users"
                    @scrollBottom="handleScrollBottom"
                    @todoTaskColumnFold="todoTaskColumnFold"
                    @todoTaskColumnunfold="todoTaskColumnUnfold"
                />
            </v-col>
        </v-row>
    </div>
</template>

<script>
import KanbanColumn from './KanbanColumn.vue';

export default {
    components: {
        KanbanColumn
    },
    props: {
        columns: Array,
        users: Array,
    },
    computed: {
        columnCols() {
            return Math.floor(12 / this.columns.length);
        }
    },
    methods: {
        
    }
}
</script>
<style>
    .todo-task-item-card-style:not(:first-of-type) {
        margin-top:8px;
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
    
    @media (max-width: 768px) {
        .kanban-column {
            flex: 0 0 100% !important;
            max-width: 100% !important;
        }
    }
</style>
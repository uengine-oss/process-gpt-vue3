<template>
    <v-card elevation="10" style="height: 100%;">
        <v-row class="ma-0 pa-0 todo-task-column-box-pc" style="height: 100%;">
            <v-col v-for="column in columns" :key="column.id"
                class="pa-2"
                cols="12" md="3" sm="3"
            >
                <KanbanColumn 
                    :column="column" 
                    :loading="loading" 
                    :isNotAll="false"
                    :showAddButton="false"
                    @scrollBottom="handleScrollBottom"
                    @todoTaskColumnFold="todoTaskColumnFold"
                    @todoTaskColumnunfold="todoTaskColumnUnfold"
                />
            </v-col>
        </v-row>
        
    </v-card>
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
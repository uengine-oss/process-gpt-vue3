<script setup lang="ts">
import TodolistTable from '@/components/apps/todolist/TodolistTable.vue';
</script>

<template>
    <v-card elevation="10">
        <v-card-text>
            <h5 class="text-h5 font-weight-semibold mb-7">Todolist</h5>
            <TodolistTable />
        </v-card-text>
    </v-card>
</template>

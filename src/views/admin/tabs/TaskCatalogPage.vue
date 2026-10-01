<template>
    <!-- 관리자 콘솔 표준 페이지 구조 (SKGlobalStyle: sk-page-card / page-header / sk-page-card-text) -->
    <v-card flat class="sk-page-card">
        <div class="page-header">
            <div class="page-header-left">
                <h1 class="page-title">{{ $t('taskCatalog.catalogSection') }}</h1>
                <p class="page-subtitle">{{ $t('taskCatalog.catalogDescription') }}</p>
            </div>
            <div class="page-header-right">
                <v-btn color="primary" size="small" prepend-icon="mdi-plus" @click="listRef?.openDialog()">
                    {{ $t('taskCatalog.addTask') }}
                </v-btn>
            </div>
        </div>

        <v-card-text class="pa-4 pt-2 sk-page-card-text">
            <TaskCatalogList ref="listRef" embedded />
        </v-card-text>
    </v-card>
</template>

<script setup>
import { ref } from 'vue';
import TaskCatalogList from '@/components/admin/TaskCatalogList.vue';

const listRef = ref(null);
</script>

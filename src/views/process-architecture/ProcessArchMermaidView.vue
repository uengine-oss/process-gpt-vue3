<template>
    <ProcessArchHierarchyView
        :procMap="procMap"
        :domains="domains"
        :processStatuses="processStatuses"
        :selectedDomain="selectedDomain"
        :hideDomainRoots="hideDomainRoots"
        :favorites="favorites"
        @navigate="handleNavigate"
        @toggleFavorite="handleToggleFavorite"
    />
</template>

<script setup lang="ts">
import ProcessArchHierarchyView from './ProcessArchHierarchyView.vue';

defineProps<{
    procMap: any;
    domains: any[];
    processStatuses: Map<string, any>;
    selectedDomain: string | null;
    hideDomainRoots?: boolean;
    favorites?: Set<string>;
}>();

const emit = defineEmits<{
    (e: 'navigate', id: string, name?: string): void;
    (e: 'toggleFavorite', id: string): void;
}>();

function handleNavigate(id: string, name?: string) {
    emit('navigate', id, name);
}

function handleToggleFavorite(id: string) {
    emit('toggleFavorite', id);
}
</script>

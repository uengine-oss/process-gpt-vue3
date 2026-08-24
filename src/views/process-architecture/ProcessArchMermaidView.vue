<template>
    <ProcessArchHierarchyView
        :procMap="procMap"
        :domains="domains"
        :processStatuses="processStatuses"
        :selectedDomain="selectedDomain"
        :hideDomainRoots="hideDomainRoots"
        :favorites="favorites"
        :isUpdatedSinceLastVisit="isUpdatedSinceLastVisit"
        :readonly="props.readonly"
        :kpiTaggedProcessIds="kpiTaggedProcessIds"
        @navigate="handleNavigate"
        @toggleFavorite="handleToggleFavorite"
        @editProcess="handleEditProcess"
        @addProcess="handleAddProcess"
    />
</template>

<script setup lang="ts">
import ProcessArchHierarchyView from './ProcessArchHierarchyView.vue';

const props = defineProps<{
    procMap: any;
    domains: any[];
    processStatuses: Map<string, any>;
    selectedDomain: string | null;
    hideDomainRoots?: boolean;
    favorites?: Set<string>;
    isUpdatedSinceLastVisit?: (process: any) => boolean;
    readonly?: boolean;
    kpiTaggedProcessIds?: Map<string, string>;
}>();

const emit = defineEmits<{
    (e: 'navigate', id: string, name?: string): void;
    (e: 'toggleFavorite', id: string): void;
    (e: 'editProcess', row: { type: string; id: string; name: string }): void;
    (e: 'addProcess', row: { type: string; megaId?: string }): void;
}>();

function handleNavigate(id: string, name?: string) {
    emit('navigate', id, name);
}

function handleToggleFavorite(id: string) {
    emit('toggleFavorite', id);
}

function handleEditProcess(row: { type: string; id: string; name: string }) {
    emit('editProcess', row);
}

function handleAddProcess(row: { type: string; megaId?: string }) {
    emit('addProcess', row);
}
</script>

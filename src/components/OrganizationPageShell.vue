<template>
    <component :is="resolvedComponent" v-if="resolvedComponent" />
    <v-container v-else-if="loadError" class="py-8">
        <v-alert type="error" variant="tonal" border="start">
            <div class="text-subtitle-1 font-weight-bold mb-2">Organization page failed to load</div>
            <pre class="organization-error">{{ errorText }}</pre>
        </v-alert>
    </v-container>
    <v-container v-else class="py-8">
        <v-progress-circular indeterminate color="primary" />
    </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue';

const resolvedComponent = shallowRef();
const loadError = shallowRef<unknown>(null);

const errorText = computed(() => {
    const error = loadError.value;
    if (!error) return '';
    if (error instanceof Error) return error.stack || error.message;
    return String(error);
});

onMounted(async () => {
    try {
        resolvedComponent.value = (await import('@/components/OrganizationChartChat.vue')).default;
    } catch (error) {
        console.error('[OrganizationPageShell] failed to load organization page:', error);
        loadError.value = error;
    }
});
</script>

<style scoped>
.organization-error {
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    font-size: 12px;
}
</style>

<template>
    <div v-if="result" class="mcp-validation-result mt-3 pa-3 rounded border">
        <div class="d-flex align-center mb-2">
            <v-chip :color="result.status === 'success' ? 'success' : 'error'" size="small" variant="flat" class="mr-2">
                {{ result.status === 'success' ? $t('MCPServer.validationSuccess') : $t('MCPServer.validationFailed') }}
            </v-chip>
            <span v-if="result.status === 'success'" class="text-caption text-medium-emphasis">
                {{ $t('MCPServer.availableTools') }} ({{ (result.tools || []).length }})
            </span>
        </div>

        <div v-if="result.error_message" class="text-error text-caption mb-2">{{ result.error_message }}</div>

        <v-list v-if="result.tools && result.tools.length" density="compact" class="mcp-validation-tools">
            <v-list-item v-for="tool in result.tools" :key="tool.name" :lines="false" class="py-1">
                <v-list-item-title class="text-body-2 font-weight-medium">{{ tool.name }}</v-list-item-title>
                <v-list-item-subtitle class="text-caption mcp-tool-description">{{ tool.description }}</v-list-item-subtitle>
            </v-list-item>
        </v-list>
        <div v-else-if="result.status === 'success'" class="text-caption text-medium-emphasis">{{ $t('MCPServer.noToolsFound') }}</div>
    </div>
</template>

<script>
export default {
    name: 'McpValidationResult',
    props: {
        result: {
            type: Object,
            default: null
        }
    }
};
</script>

<style scoped>
.mcp-validation-tools {
    max-height: 240px;
    overflow-y: auto;
}
.mcp-tool-description {
    white-space: normal;
    overflow: visible;
    -webkit-line-clamp: unset;
}
</style>

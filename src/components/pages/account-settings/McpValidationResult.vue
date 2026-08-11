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
                <template v-if="selectable" #prepend>
                    <v-checkbox-btn
                        :model-value="isSelected(tool.name)"
                        density="compact"
                        @update:model-value="(checked) => toggle(tool.name, checked)"
                    />
                </template>
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
        },
        // true면 도구별 체크박스를 표시해 부분 선택을 허용한다 (기본값 false: 조회 전용).
        selectable: {
            type: Boolean,
            default: false
        },
        // selectable일 때 현재 선택된 도구 이름 목록. null/undefined면 "전체 허용"으로 취급.
        modelValue: {
            type: Array,
            default: null
        }
    },
    emits: ['update:modelValue'],
    methods: {
        isSelected(name) {
            return !this.modelValue || this.modelValue.includes(name);
        },
        toggle(name, checked) {
            const allNames = (this.result.tools || []).map((t) => t.name);
            const current = this.modelValue || allNames.slice();
            const next = checked ? Array.from(new Set([...current, name])) : current.filter((n) => n !== name);
            // 전부 선택된 상태면 "제한 없음"을 뜻하는 null로 되돌린다.
            this.$emit('update:modelValue', next.length === allNames.length ? null : next);
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

<template>
    <v-slide-y-reverse-transition>
        <div v-if="show" class="validation-console-panel">
            <div class="validation-console-header d-flex align-center pa-2 px-3">
                <v-icon size="18" class="mr-2">mdi-shield-check-outline</v-icon>
                <span class="text-subtitle-2 font-weight-medium">{{ $t('validationConsole.title') }}</span>
                <v-spacer />
                <v-chip v-if="errorCount > 0" size="x-small" color="error" class="mr-1">
                    {{ $t('validationConsole.errorCount', { n: errorCount }) }}
                </v-chip>
                <v-chip v-if="warningCount > 0" size="x-small" color="warning" class="mr-1">
                    {{ $t('validationConsole.warningCount', { n: warningCount }) }}
                </v-chip>
                <v-btn icon variant="text" size="x-small" @click="$emit('close')">
                    <v-icon size="16">mdi-close</v-icon>
                </v-btn>
            </div>
            <div class="validation-console-body">
                <div v-if="items.length === 0" class="pa-3 text-body-2 text-medium-emphasis text-center">
                    <v-icon size="20" color="success" class="mr-1">mdi-check-circle</v-icon>
                    {{ $t('validationConsole.noIssues') }}
                </div>
                <v-list v-else density="compact" class="pa-0">
                    <v-list-item
                        v-for="(item, index) in items"
                        :key="index"
                        class="validation-item"
                        :class="{ 'clickable': !!item.elementId }"
                        @click="item.elementId && $emit('focusElement', item.elementId)"
                    >
                        <template v-slot:prepend>
                            <v-icon
                                :color="item.level === 'error' ? 'error' : 'warning'"
                                size="16"
                            >
                                {{ item.level === 'error' ? 'mdi-close-circle' : 'mdi-alert' }}
                            </v-icon>
                        </template>
                        <v-list-item-title class="text-body-2">
                            {{ item.message }}
                        </v-list-item-title>
                        <v-list-item-subtitle v-if="item.elementName" class="text-caption">
                            {{ item.elementName }}
                        </v-list-item-subtitle>
                    </v-list-item>
                </v-list>
            </div>
        </div>
    </v-slide-y-reverse-transition>
</template>

<script>
export default {
    name: 'ValidationConsolePanel',
    props: {
        show: {
            type: Boolean,
            default: false
        },
        items: {
            type: Array,
            default: () => []
        }
    },
    emits: ['close', 'focusElement'],
    computed: {
        errorCount() {
            return this.items.filter(i => i.level === 'error').length;
        },
        warningCount() {
            return this.items.filter(i => i.level === 'warning').length;
        }
    }
};
</script>

<style scoped>
.validation-console-panel {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 200px;
    background: white;
    border-top: 1px solid #e0e0e0;
    z-index: 10;
    display: flex;
    flex-direction: column;
}
.validation-console-header {
    background: #f5f5f5;
    border-bottom: 1px solid #e0e0e0;
    min-height: 36px;
}
.validation-console-body {
    overflow-y: auto;
    flex: 1;
}
.validation-item.clickable {
    cursor: pointer;
}
.validation-item.clickable:hover {
    background: #f5f5f5;
}
</style>

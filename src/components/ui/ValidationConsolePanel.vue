<template>
    <v-slide-y-reverse-transition>
        <div v-if="show" class="validation-console-root">
            <v-card
                class="validation-console-card rounded-t-xl"
                elevation="4"
                border
            >
                <div class="validation-console-header d-flex align-center flex-nowrap px-3 py-2">
                    <div class="d-flex align-center min-w-0 flex-grow-1">
                        <v-icon size="22" class="mr-2 flex-shrink-0 validation-console-header-icon">
                            mdi-clipboard-check-outline
                        </v-icon>
                        <span class="text-subtitle-2 font-weight-medium text-truncate validation-console-header-title">
                            {{ $t('validationConsole.title') }}
                        </span>
                    </div>
                    <div class="d-flex align-center flex-shrink-0 gap-1 ml-2">
                        <v-chip
                            v-if="errorCount > 0"
                            size="small"
                            color="surface"
                            variant="flat"
                            class="font-weight-medium validation-console-count-chip validation-console-count-chip--error"
                        >
                            {{ $t('validationConsole.errorCount', { n: errorCount }) }}
                        </v-chip>
                        <v-chip
                            v-if="warningCount > 0"
                            size="small"
                            color="surface"
                            variant="flat"
                            class="font-weight-medium validation-console-count-chip validation-console-count-chip--warn"
                        >
                            {{ $t('validationConsole.warningCount', { n: warningCount }) }}
                        </v-chip>
                        <v-btn
                            icon
                            variant="text"
                            size="small"
                            class="ml-1 validation-console-close"
                            @click="$emit('close')"
                        >
                            <v-icon size="20">mdi-close</v-icon>
                        </v-btn>
                    </div>
                </div>

                <v-divider thickness="1" class="validation-console-header-divider" />

                <div class="validation-console-body">
                    <div v-if="items.length === 0" class="validation-console-empty pa-6 text-center">
                        <v-icon size="40" color="success" class="mb-2">mdi-check-decagram</v-icon>
                        <div class="text-body-2 text-medium-emphasis">{{ $t('validationConsole.noIssues') }}</div>
                    </div>
                    <v-list v-else density="comfortable" class="py-2 bg-transparent" lines="two">
                        <v-list-item
                            v-for="(item, index) in items"
                            :key="index"
                            variant="flat"
                            class="validation-list-item px-3 py-2"
                            :class="{ 'validation-list-item--clickable': !!item.elementId }"
                            @click="item.elementId && $emit('focusElement', item.elementId)"
                        >
                            <template v-slot:prepend>
                                <v-icon
                                    :color="item.level === 'error' ? 'error' : 'warning'"
                                    size="22"
                                    class="mt-1"
                                >
                                    {{ item.level === 'error' ? 'mdi-close-circle' : 'mdi-alert-circle-outline' }}
                                </v-icon>
                            </template>
                            <v-list-item-title class="text-body-2 text-wrap">{{ item.message }}</v-list-item-title>
                            <v-list-item-subtitle v-if="item.elementName" class="text-caption mt-1 opacity-90">
                                {{ item.elementName }}
                            </v-list-item-subtitle>
                        </v-list-item>
                    </v-list>
                </div>
            </v-card>
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
            return this.items.filter((i) => i.level === 'error').length;
        },
        warningCount() {
            return this.items.filter((i) => i.level === 'warning').length;
        }
    }
};
</script>

<style scoped>
.validation-console-root {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 12;
    padding: 0 8px;
    pointer-events: none;
}
.validation-console-card {
    pointer-events: auto;
    max-height: min(42vh, 280px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow:
        0 -4px 16px rgba(0, 0, 0, 0.06),
        0 -1px 0 rgba(0, 0, 0, 0.04);
}
.validation-console-header {
    background: rgb(var(--v-theme-primary));
    color: rgb(var(--v-theme-on-primary));
}
.validation-console-header-title,
.validation-console-header-icon {
    color: rgb(var(--v-theme-on-primary));
}
.validation-console-close {
    color: rgb(var(--v-theme-on-primary)) !important;
}
.validation-console-header-divider {
    border-color: rgba(var(--v-theme-on-primary), 0.28) !important;
    opacity: 1;
}
.validation-console-count-chip {
    box-shadow: none !important;
}
.validation-console-count-chip--error {
    color: rgb(var(--v-theme-error)) !important;
    background: rgb(var(--v-theme-surface)) !important;
}
.validation-console-count-chip--warn {
    color: rgb(var(--v-theme-warning)) !important;
    background: rgb(var(--v-theme-surface)) !important;
}
.validation-console-body {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    background: rgb(var(--v-theme-surface));
}
.validation-console-empty {
    background: rgb(var(--v-theme-surface));
}
.validation-list-item {
    border-radius: 0 !important;
    min-height: auto !important;
    box-shadow: none !important;
    background: transparent !important;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}
.validation-list-item:last-child {
    border-bottom: none;
}
.validation-list-item--clickable {
    cursor: pointer;
    transition: background-color 0.12s ease;
}
.validation-list-item--clickable:hover {
    background-color: rgba(var(--v-theme-primary), 0.06) !important;
}
.gap-1 {
    gap: 4px;
}
</style>

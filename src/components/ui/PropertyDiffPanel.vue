<template>
    <v-card elevation="0" class="property-diff-panel">
        <v-card-title class="d-flex align-center pa-3 pb-2">
            <v-icon class="mr-2" size="20">mdi-compare-horizontal</v-icon>
            <span class="text-subtitle-1 font-weight-medium">{{ $t('propertyDiff.title') }}</span>
        </v-card-title>
        <v-divider />

        <v-card-text v-if="diffs.length === 0" class="text-center text-medium-emphasis pa-6">
            <v-icon size="40" color="grey-lighten-2" class="mb-2">mdi-check-circle-outline</v-icon>
            <div>{{ $t('propertyDiff.noChanges') }}</div>
        </v-card-text>

        <v-expansion-panels v-else variant="accordion" class="pa-2">
            <v-expansion-panel
                v-for="diff in diffs"
                :key="diff.elementId"
            >
                <v-expansion-panel-title class="py-2">
                    <div class="d-flex align-center gap-2">
                        <v-icon size="16" color="primary">mdi-shape-outline</v-icon>
                        <span class="text-body-2 font-weight-medium">{{ diff.elementName || diff.elementId }}</span>
                        <v-chip size="x-small" color="warning" variant="tonal">
                            {{ diff.properties.length }}
                        </v-chip>
                    </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                    <v-table density="compact" class="property-diff-table">
                        <thead>
                            <tr>
                                <th class="text-caption">{{ $t('propertyDiff.property') }}</th>
                                <th class="text-caption">{{ $t('propertyDiff.oldValue') }}</th>
                                <th class="text-caption">{{ $t('propertyDiff.newValue') }}</th>
                                <th class="text-caption" style="width: 60px;"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="prop in diff.properties" :key="prop.key">
                                <td class="text-body-2 font-weight-medium">{{ prop.key }}</td>
                                <td class="text-body-2 text-error">
                                    <code class="diff-old">{{ formatValue(prop.oldValue) }}</code>
                                </td>
                                <td class="text-body-2 text-success">
                                    <code class="diff-new">{{ formatValue(prop.newValue) }}</code>
                                </td>
                                <td>
                                    <v-btn
                                        size="x-small"
                                        variant="tonal"
                                        color="warning"
                                        @click="onRevert(diff.elementId, prop.key, prop.oldValue)"
                                    >
                                        <v-icon size="14">mdi-undo</v-icon>
                                    </v-btn>
                                </td>
                            </tr>
                        </tbody>
                    </v-table>
                </v-expansion-panel-text>
            </v-expansion-panel>
        </v-expansion-panels>
    </v-card>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue';

interface PropertyChange {
    key: string;
    oldValue: any;
    newValue: any;
}

interface PropertyDiff {
    elementId: string;
    elementName: string;
    properties: PropertyChange[];
}

export default defineComponent({
    name: 'PropertyDiffPanel',
    props: {
        oldActivities: {
            type: Array,
            default: () => []
        },
        newActivities: {
            type: Array,
            default: () => []
        }
    },
    emits: ['revert'],
    setup(props, { emit }) {
        const IGNORE_KEYS = ['_type', '$type', 'id'];

        const diffs = computed((): PropertyDiff[] => {
            const oldMap = new Map<string, any>();
            (props.oldActivities as any[]).forEach(a => {
                const key = a.tracingTag || a.id;
                if (key) oldMap.set(key, a);
            });

            const result: PropertyDiff[] = [];

            (props.newActivities as any[]).forEach(newAct => {
                const key = newAct.tracingTag || newAct.id;
                if (!key) return;
                const oldAct = oldMap.get(key);
                if (!oldAct) return;

                const changes: PropertyChange[] = [];
                const allKeys = new Set([...Object.keys(oldAct), ...Object.keys(newAct)]);

                allKeys.forEach(k => {
                    if (IGNORE_KEYS.includes(k)) return;
                    const oldVal = oldAct[k];
                    const newVal = newAct[k];
                    const oldStr = JSON.stringify(oldVal ?? '');
                    const newStr = JSON.stringify(newVal ?? '');
                    if (oldStr !== newStr) {
                        changes.push({ key: k, oldValue: oldVal, newValue: newVal });
                    }
                });

                if (changes.length > 0) {
                    result.push({
                        elementId: key,
                        elementName: newAct.name || oldAct.name || key,
                        properties: changes
                    });
                }
            });

            return result;
        });

        const formatValue = (val: any): string => {
            if (val === undefined || val === null) return '—';
            if (typeof val === 'object') return JSON.stringify(val, null, 1);
            return String(val);
        };

        const onRevert = (elementId: string, propertyKey: string, value: any) => {
            emit('revert', { elementId, propertyKey, value });
        };

        return { diffs, formatValue, onRevert };
    }
});
</script>

<style scoped>
.property-diff-panel {
    border: none;
}
.property-diff-table code {
    font-size: 11px;
    padding: 1px 4px;
    border-radius: 3px;
}
.diff-old {
    background-color: #fce4ec;
    color: #c62828;
}
.diff-new {
    background-color: #e8f5e9;
    color: #2e7d32;
}
</style>

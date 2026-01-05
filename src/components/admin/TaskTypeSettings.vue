<template>
    <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-4">
            {{ $t('taskCatalog.taskTypesDescription') }}
        </v-alert>

        <v-data-table
            :headers="headers"
            :items="paletteTaskTypes"
            :loading="loading"
            class="elevation-1"
        >
            <template v-slot:item.icon="{ item }">
                <v-icon v-if="item.icon">{{ item.icon }}</v-icon>
            </template>

            <template v-slot:item.label="{ item }">
                {{ getLabel(item) }}
            </template>

            <template v-slot:item.is_enabled="{ item }">
                <v-switch
                    :model-value="item.is_enabled"
                    @update:model-value="toggleTaskType(item.id)"
                    hide-details
                    color="primary"
                    density="compact"
                />
            </template>

            <template v-slot:item.status="{ item }">
                <v-chip
                    :color="item.is_enabled ? 'success' : 'grey'"
                    size="small"
                >
                    {{ item.is_enabled ? $t('taskCatalog.enabled') : $t('taskCatalog.disabled') }}
                </v-chip>
            </template>

            <template v-slot:no-data>
                <v-alert type="info" variant="tonal">
                    {{ $t('taskCatalog.noTaskTypes') }}
                </v-alert>
            </template>
        </v-data-table>
    </v-card-text>
</template>

<script>
import { useTaskCatalogStore } from '@/stores/taskCatalog';

export default {
    name: 'TaskTypeSettings',
    data() {
        return {
            store: null
        };
    },
    computed: {
        loading() {
            return this.store?.loading || false;
        },
        paletteTaskTypes() {
            return this.store?.paletteTaskTypes || [];
        },
        headers() {
            return [
                { title: '', key: 'icon', sortable: false, width: '50px' },
                { title: this.$t('taskCatalog.taskType'), key: 'task_type', sortable: true },
                { title: this.$t('taskCatalog.label'), key: 'label', sortable: true },
                { title: this.$t('taskCatalog.enabled'), key: 'is_enabled', sortable: false, width: '100px' },
                { title: this.$t('taskCatalog.status'), key: 'status', sortable: false, width: '120px' }
            ];
        }
    },
    methods: {
        getLabel(item) {
            return this.$i18n.locale === 'ko' && item.label_ko ? item.label_ko : item.label;
        },
        async toggleTaskType(id) {
            try {
                await this.store.togglePaletteTaskType(id);
            } catch (error) {
                console.error('Failed to toggle task type:', error);
            }
        }
    },
    async mounted() {
        this.store = useTaskCatalogStore();
        if (!this.store.paletteTaskTypesLoaded) {
            await this.store.loadPaletteTaskTypes();
        }
    }
};
</script>

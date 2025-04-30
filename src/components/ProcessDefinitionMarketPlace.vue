<template>
    <v-card>
        <v-card-title class="d-flex justify-space-between">
            <div>마켓플레이스</div>
            <v-btn @click="close" icon variant="text" density="comfortable">
                <Icons :icon="'close'" :size="16" />
            </v-btn>
        </v-card-title>
        <v-card-text>
            <div class="text-h4">
                프로세스 템플릿
            </div>
            <v-row dense class="mt-4">
                <v-col v-for="definition in definitionList" :key="definition.id" cols="12" md="4" class="mb-4">
                    <v-card class="mx-auto" max-width="344" variant="outlined">
                        <v-card-title class="d-flex justify-space-between">
                            <div>{{ definition.name }}</div>
                            <v-chip v-if="definition.import_count > 0" label color="primary" density="compact">
                                {{ definition.import_count + '+ 추가' }}
                            </v-chip>
                        </v-card-title>
                        <v-card-text>
                            <div class="text-body-1">{{ definition.description }}</div>
                            <div class="mt-2">
                                <v-chip v-for="tag in definition.tags" :key="tag" label density="compact" class="mr-1">
                                    {{ tag }}
                                </v-chip>
                            </div>
                        </v-card-text>
                        <v-card-actions>
                            <div class="text-body-1">{{ definition.author_name }}</div>
                            <v-btn 
                                :disabled="definition.isImported"
                                @click="importDefinition(definition)" 
                                :color="definition.isImported ? 'grey' : 'primary'" 
                                variant="flat" 
                                class="ml-auto"
                            >
                                {{ definition.isImported ? '추가됨' : '추가' }}
                            </v-btn>
                        </v-card-actions>
                    </v-card>
                </v-col>
            </v-row>
        </v-card-text>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    data: () => ({
        definitionList: [],
    }),
    async mounted() {
        await this.getDefinitionList();
    },
    watch: {
    },
    computed: {
    },
    methods: {
        async getDefinitionList() {
            const list = await backend.listMarketplaceDefinition();
            list.forEach(async (definition) => {
                const result = await backend.getRawDefinition(definition.id);
                let isImported = false;
                if (result) {
                    isImported = true;
                }
                const tags = definition.tags.split(',');
                this.definitionList.push({
                    ...definition,
                    tags: tags,
                    isImported: isImported
                });
            });
        },
        async importDefinition(definition) {
            this.$try({
                action: async () => {
                    const result = await backend.duplicateDefinition(definition);
                    if (result) {
                        definition.isImported = true;
                        this.EventBus.emit('definitions-updated');
                    }
                },
                successMsg: '추가되었습니다.'
            })
        },
        close() {
            this.$emit('closeMarketplaceDialog');
        }
    }
};
</script>

<style scoped>
</style>

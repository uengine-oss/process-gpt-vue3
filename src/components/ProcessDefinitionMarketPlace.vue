<template>
    <v-card>
        <!-- 닫기 버튼을 우측 끝에 배치 -->
        <v-card-title class="d-flex justify-end pa-2 pb-0">
            <v-btn @click="close" icon variant="text" density="comfortable">
                <Icons :icon="'close'" :size="16" />
            </v-btn>
        </v-card-title>
        <v-card-text class="pa-4">
            <!-- Vuetify3의 v-text 컴포넌트를 사용하여 중앙정렬로 텍스트 표시 -->
            <div class="text-h4" style="text-align: center;">프로세스 템플릿</div>
            <v-row dense class="mt-4">
                <v-col v-for="definition in definitionList" :key="definition.id" cols="12" sm="6" md="4" class="mb-0 pa-4">
                    <v-card variant="outlined">
                        <v-img class="marketplace-image" height="140px" cover>
                            <div class="chip-container pb-2">
                                <v-chip
                                    v-for="tag in definition.tags"
                                    :key="tag"
                                    size="small"
                                    class="template-chip"
                                    color="primary"
                                    variant="outlined"
                                >
                                    {{ tag }}
                                </v-chip>
                            </div>
                        </v-img>
                        <div class="pa-2">
                                <v-row class="ma-0 pa-0">
                                    <v-col cols="9" class="ma-0 pa-0">
                                        <v-card-title class="ma-0 pa-0">{{ definition.name }}</v-card-title>
                                    </v-col>
                                    <!-- 칩을 col 내부에서 오른쪽 끝에 배치 -->
                                    <v-col cols="3" class="ma-0 pa-0 d-flex justify-end">
                                        <!-- '추가' 텍스트 대신 mdi-plus 아이콘으로 대체 -->
                                        <v-chip v-if="definition.import_count > 0" color="primary" density="compact">
                                            <v-icon size="12" class="mr-1">mdi-plus</v-icon>
                                            {{ definition.import_count }}
                                        </v-chip>
                                    </v-col>
                                </v-row>
                            <div class="text-body-1">{{ definition.description }}</div>
                            <v-divider class="my-4"></v-divider>
                            <v-row class="ma-0 pa-0">
                                <div class="text-body-1">{{ definition.author_name }}</div>
                                <v-btn 
                                    :disabled="definition.isImported"
                                    @click="importDefinition(definition)" 
                                    :color="definition.isImported ? 'grey' : 'primary'" 
                                    variant="flat"
                                    density="compact"
                                    class="ml-auto"
                                    rounded="xl"
                                >
                                    {{ definition.isImported ? '추가됨' : '추가' }}
                                </v-btn>
                            </v-row>
                        </div>
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

.chip-container {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 1;
}

.template-chip {
    margin-right: 4px;
    background-color: rgba(255, 255, 255, 0.9) !important;
}

.marketplace-image {
    /* 엄청 연한 회색 배경색 적용 */
    background-color: #f5f5f5;
}
</style>

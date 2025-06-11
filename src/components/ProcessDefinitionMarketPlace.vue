<template>
    <v-card>
        <!-- 닫기 버튼을 우측 끝에 배치 -->
        <v-card-title class="d-flex justify-end pa-2 pb-0">
            <v-btn @click="close" icon variant="text" density="comfortable">
                <Icons :icon="'close'" :size="16" />
            </v-btn>
        </v-card-title>
        <!-- 
            반응형으로 가득차게 만들기 위해 v-container, v-row, v-col을 사용하고,
            내부 div의 스타일을 제거하여 가로로 가득차게 만듦
    -->
        <v-row class="ma-0 pa-0 pl-4 pr-4 pt-4">
            <v-col cols="12" class="pa-0">
                <div class="d-flex align-center flex-fill border border-borderColor rounded-pill px-5 w-100">
                    <Icons :icon="'magnifer-linear'" :size="22" />
                    <v-text-field v-model="searchKeyword"
                        variant="plain"
                        density="compact"
                        class="position-relative pt-0 ml-3 custom-placeholer-color"
                        :placeholder="$t('ProcessDefinitionMarketPlace.searchPlaceholder')"
                        single-line hide-details
                        @update:model-value="onSearchChange"
                        :loading="isSearching"
                    ></v-text-field>
                </div>
            </v-col>
        </v-row>
        <v-card-text class="pa-0 ma-0">
            <!-- 태그 필터 칩 그룹 (탭 상단에 위치) -->
            <v-chip-group v-if="!isSearchMode"
                v-model="selectedTag"
                selected-class="tag-selected"
                column
                class="marketplace-tag-list pa-4"
                @update:model-value="onTagChange"
            >
                <v-chip
                    key="all"
                    value="all"
                    :color="selectedTag === 'all' ? 'primary' : undefined"
                    :text-color="selectedTag === 'all' ? 'white' : undefined"
                    :variant="selectedTag === 'all' ? 'elevated' : 'tonal'"
                    filter
                    class="tag-chip"
                >
                    {{ $t('ProcessDefinitionMarketPlace.allCategory') }}
                </v-chip>
                <v-chip
                    v-for="tag in getAllAvailableTags()"
                    :key="tag"
                    :value="tag"
                    :color="tag === selectedTag ? 'primary' : undefined"
                    :text-color="tag === selectedTag ? 'white' : undefined"
                    :variant="tag === selectedTag ? 'elevated' : 'tonal'"
                    filter
                    class="tag-chip"
                >
                    {{ tag }}
                </v-chip>
            </v-chip-group>
            
            <!-- 검색 결과가 있는 경우 -->
            <template v-if="isSearchMode">
                <v-card-title class="text-h5 mt-4" v-if="!isSearching">
                    "{{ searchKeyword }}" {{ $t('ProcessDefinitionMarketPlace.searchResultTitle') }} ({{ searchResults && searchResults.length || 0 }}{{ $t('ProcessDefinitionMarketPlace.countUnit') }})
                </v-card-title>
                <v-card-title class="text-h5 mt-4" v-else>
                    "{{ searchKeyword }}" {{ $t('ProcessDefinitionMarketPlace.searchingTitle') }}
                </v-card-title>
                
                <v-row dense class="ma-0 pa-0 marketplace-scroll-area">
                    <v-col v-for="definition in searchResults" :key="definition.id" cols="12" sm="6" md="4" class="mb-0 pa-2 pl-4">
                        <!-- 카테고리 표시 (모든 항목 표시) -->
                        <div class="category-label">
                            {{ getCategoryLabel(definition) }}
                        </div>
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
                                        {{ definition.isImported ? $t('ProcessDefinitionMarketPlace.addedButton') : $t('ProcessDefinitionMarketPlace.addButton') }}
                                    </v-btn>
                                </v-row>
                            </div>
                        </v-card>
                    </v-col>
                </v-row>
            </template>
            
            <!-- 선택된 태그가 '전체'일 때 심플하게 모든 정의 표시 -->
            <template v-else-if="selectedTag === 'all'">
                <v-card-title class="text-h5 pl-4 pr-4 pt-4">
                    {{ $t('ProcessDefinitionMarketPlace.allTemplates') }}
                </v-card-title>
                
                <v-row dense class="marketplace-scroll-area pa-0 ma-0 pl-2 pr-2">
                    <v-col v-for="definition in definitionList" :key="definition.id" cols="12" sm="6" md="4" class="mb-4 pa-2">
                        <!-- 카테고리 표시 -->
                        <div class="category-label">
                            {{ getCategoryLabel(definition) }}
                        </div>
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
                                        {{ definition.isImported ? $t('ProcessDefinitionMarketPlace.addedButton') : $t('ProcessDefinitionMarketPlace.addButton') }}
                                    </v-btn>
                                </v-row>
                            </div>
                        </v-card>
                    </v-col>
                </v-row>
            </template>
            
            <!-- 특정 태그가 선택된 경우 -->
            <template v-else>
                <v-card-title class="text-h5 mt-2 pl-4 pr-4">
                    {{ selectedTag }} {{ $t('ProcessDefinitionMarketPlace.relatedTemplates') }}
                </v-card-title>
                
                <v-row dense class="marketplace-scroll-area pa-0 ma-0">
                    <v-col v-for="definition in filteredDefinitions" :key="definition.id" cols="12" sm="6" md="4" class="mb-0 pa-2 pl-4">
                        <!-- 카테고리 표시 (모든 항목 표시) -->
                        <div class="category-label">
                            {{ getCategoryLabel(definition) }}
                        </div>
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
                                        {{ definition.isImported ? $t('ProcessDefinitionMarketPlace.addedButton') : $t('ProcessDefinitionMarketPlace.addButton') }}
                                    </v-btn>
                                </v-row>
                            </div>
                        </v-card>
                    </v-col>
                </v-row>
            </template>
        </v-card-text>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    data: () => ({
        definitionList: [],
        filteredDefinitions: [],
        selectedTab: null,
        selectedTag: 'all',
        isLoading: false,
        searchKeyword: '',
        isSearching: false,
        searchResults: [],
        searchTimeout: null
    }),
    async mounted() {
        await this.getDefinitionList();
        // 데이터 로딩 완료 후 첫 번째 탭 선택
        this.$nextTick(() => {
            if (this.categories.length > 0) {
                this.selectedTab = this.categories[0];
            }
        });
    },
    computed: {
        categories() {
            const uniqueCategories = new Set();
            this.definitionList.forEach(definition => {
                if (definition.category && definition.category.includes('/')) {
                    uniqueCategories.add(definition.category.split('/')[0]);
                } else {
                    uniqueCategories.add(this.$t('ProcessDefinitionMarketPlace.otherCategory'));
                }
            });
            return Array.from(uniqueCategories);
        },
        isSearchMode() {
            return !!this.searchKeyword && typeof this.searchKeyword === 'string' && this.searchKeyword.trim() !== '';
        }
    },
    methods: {
        async getDefinitionList() {
            this.isLoading = true;
            try {
                const list = await backend.listMarketplaceDefinition();
                const promises = list.map(async (definition) => {
                    const result = await backend.getRawDefinition(definition.id);
                    let isImported = false;
                    if (result) {
                        isImported = true;
                    }
                    
                    // 태그 중복 제거 및 공백 처리
                    let tags = [];
                    if (definition.tags) {
                        // 쉼표로 구분된 태그를 분리하고 중복 제거
                        const tagSet = new Set();
                        definition.tags.split(',').forEach(tag => {
                            const trimmedTag = tag.trim();
                            if (trimmedTag) {
                                tagSet.add(trimmedTag);
                            }
                        });
                        tags = Array.from(tagSet);
                    }
                    
                    return {
                        ...definition,
                        tags: tags,
                        isImported: isImported
                    };
                });
                
                // 모든 비동기 작업이 완료될 때까지 기다림
                const definitions = await Promise.all(promises);
                this.definitionList = definitions;
                
                // 데이터 로딩 완료 후 첫 번째 탭 선택 (중복 보장)
                if (this.categories.length > 0) {
                    this.selectedTab = this.categories[0];
                }
            } catch (error) {
                console.error('마켓플레이스 정의를 가져오는 중 오류 발생:', error);
            } finally {
                this.isLoading = false;
            }
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
            });
        },
        close() {
            this.$emit('closeMarketplaceDialog');
        },
        getDefinitionsByCategory(category) {
            if (category === this.$t('ProcessDefinitionMarketPlace.otherCategory')) {
                return this.definitionList.filter(definition => 
                    !definition.category || !definition.category.includes('/'));
            }
            return this.definitionList.filter(definition => 
                definition.category && 
                definition.category.includes('/') && 
                definition.category.split('/')[0] === category);
        },
        getCategoryTitle(category) {
            // 기타 카테고리는 제목 없음
            if (category === this.$t('ProcessDefinitionMarketPlace.otherCategory')) {
                return '';
            }
            
            // 해당 카테고리의 첫 번째 아이템에서 제목 추출
            const firstItem = this.definitionList.find(definition => 
                definition.category && 
                definition.category.includes('/') && 
                definition.category.split('/')[0] === category);
                
            if (firstItem && firstItem.category.includes('/')) {
                return firstItem.category.split('/')[1];
            }
            
            return '';
        },
        getAllAvailableTags() {
            // 모든 카테고리의 정의에서 고유한 태그 추출
            const tags = new Set();
            this.definitionList.forEach(definition => {
                if (definition.tags && Array.isArray(definition.tags)) {
                    definition.tags.forEach(tag => {
                        if (tag && tag.trim()) {
                            tags.add(tag.trim());
                        }
                    });
                }
            });
            return Array.from(tags);
        },
        getCategoryLabel(definition) {
            if (definition.category && definition.category.includes('/')) {
                const parts = definition.category.split('/');
                return `${parts[0]} > ${parts[1]}`;
            }
            return this.$t('ProcessDefinitionMarketPlace.otherCategory');
        },
        async onTagChange(tag) {
            this.selectedTag = tag;
            
            this.isLoading = true;
            try {
                if (tag === 'all') {
                    // 전체 선택 시 모든 정의 가져오기
                    await this.getDefinitionList();
                } else {
                    // 백엔드에서 태그 기반으로 필터링된 정의 가져오기
                    const serverFiltered = await backend.listMarketplaceDefinition(tag);
                    
                    const promises = serverFiltered.map(async (definition) => {
                        const result = await backend.getRawDefinition(definition.id);
                        let isImported = false;
                        if (result) {
                            isImported = true;
                        }
                        
                        // 태그 중복 제거 및 공백 처리
                        let tags = [];
                        if (definition.tags) {
                            // 쉼표로 구분된 태그를 분리하고 중복 제거
                            const tagSet = new Set();
                            definition.tags.split(',').forEach(tag => {
                                const trimmedTag = tag.trim();
                                if (trimmedTag) {
                                    tagSet.add(trimmedTag);
                                }
                            });
                            tags = Array.from(tagSet);
                        }
                        
                        return {
                            ...definition,
                            tags: tags,
                            isImported: isImported
                        };
                    });
                    
                    // 모든 비동기 작업이 완료될 때까지 기다림
                    this.filteredDefinitions = await Promise.all(promises);
                }
            } catch (error) {
                console.error('태그 필터링 중 오류 발생:', error);
            } finally {
                this.isLoading = false;
            }
        },
        // 검색 기능
        async onSearchChange(keyword) {
            // 검색어가 비어있으면 검색 모드 해제
            if (!keyword || keyword.trim() === '') {
                this.searchResults = [];
                return;
            }
            
            // 타이핑 중에는 검색 요청 지연 (디바운싱)
            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout);
            }
            
            this.isSearching = true;
            
            this.searchTimeout = setTimeout(async () => {
                try {
                    // 백엔드에서 검색 실행
                    const results = await backend.listMarketplaceDefinition(keyword, true);
                    
                    if (!results || !Array.isArray(results)) {
                        this.searchResults = [];
                        this.isSearching = false;
                        return;
                    }
                    
                    const promises = results.map(async (definition) => {
                        if (!definition) return null;
                        
                        let isImported = false;
                        try {
                            const result = await backend.getRawDefinition(definition.id);
                            if (result) {
                                isImported = true;
                            }
                        } catch (err) {
                            console.error(`정의 불러오기 오류: ${err.message}`);
                        }
                        
                        // 태그 중복 제거 및 공백 처리
                        let tags = [];
                        if (definition.tags) {
                            // 쉼표로 구분된 태그를 분리하고 중복 제거
                            const tagSet = new Set();
                            definition.tags.split(',').forEach(tag => {
                                const trimmedTag = tag ? tag.trim() : '';
                                if (trimmedTag) {
                                    tagSet.add(trimmedTag);
                                }
                            });
                            tags = Array.from(tagSet);
                        }
                        
                        return {
                            ...definition,
                            tags: tags,
                            isImported: isImported
                        };
                    });
                    
                    try {
                        // 모든 비동기 작업이 완료될 때까지 기다림
                        const searchResults = await Promise.all(promises);
                        // null 값 제거
                        this.searchResults = searchResults.filter(item => item !== null);
                    } catch (err) {
                        console.error(`검색 결과 처리 오류: ${err.message}`);
                        this.searchResults = [];
                    }
                } catch (error) {
                    console.error('검색 중 오류 발생:', error);
                    this.searchResults = [];
                } finally {
                    this.isSearching = false;
                }
            }, 500); // 0.5초 후에 검색 실행
        }
    }
};
</script>

<style scoped>
.marketplace-scroll-area {
    max-height: 60vh;
    min-height: 60vh;
    overflow: auto;
    padding: 0px 8px 0px 8px;
}

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

.tag-chip {
    margin-right: 8px;
    white-space: nowrap;
    min-width: fit-content;
}

.tag-selected {
    font-weight: bold;
}

.category-label {
    font-size: 0.9rem;
    color: #666;
    margin-bottom: 4px;
    font-weight: 500;
}

.marketplace-search-bar {
    max-width: 600px;
    margin: 0 auto;
}

@media only screen and (max-width: 600px) {
    .marketplace-scroll-area {
        max-height: 100%;
        min-height: 100%;
        overflow: auto;
        padding: 0px 8px 0px 8px;
    }
}
</style>

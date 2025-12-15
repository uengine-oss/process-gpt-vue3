<template>
    <v-card>
        <!-- 닫기 버튼을 우측 끝에 배치 -->
        <v-row class="ma-0 pa-4 pb-0 align-center">
            <v-card-title class="pa-0"
            >{{ $t('processDefinitionMap.marketplace') }}
            </v-card-title>
            <v-spacer></v-spacer>
            <v-btn @click="close"
                class="ml-auto" 
                variant="text" 
                density="compact"
                icon
            >
                <v-icon>mdi-close</v-icon>
            </v-btn>
        </v-row>
        <!-- 
            반응형으로 가득차게 만들기 위해 v-container, v-row, v-col을 사용하고,
            내부 div의 스타일을 제거하여 가로로 가득차게 만듦
        -->
        <div class="marketplace-scroll-area" @scroll="handleScroll">
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
                            @keyup.enter="onSearchChange"
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
                    <v-card-title class="text-h5 mt-4 pl-4">
                        "{{ lastSearchedKeyword }}" {{ $t('ProcessDefinitionMarketPlace.searchResultTitle') }}<span v-if="!isSearching"> ({{ searchResults && searchResults.length || 0 }}{{ $t('ProcessDefinitionMarketPlace.countUnit') }})</span>
                    </v-card-title>
                    
                    <!-- 검색 중 스켈레톤 카드 -->
                    <v-row v-if="isSearching" dense class="pa-0 ma-0 pl-2 pr-2">
                        <v-col v-for="n in 12" :key="'skeleton-search-' + n" cols="12" sm="6" md="4" class="mb-4 pa-2">
                            <v-card variant="outlined" class="skeleton-card">
                                <v-skeleton-loader type="image"></v-skeleton-loader>
                                <div class="pa-2">
                                    <v-skeleton-loader type="heading" class="mb-2"></v-skeleton-loader>
                                    <v-skeleton-loader type="text" class="mb-4"></v-skeleton-loader>
                                    <v-divider class="my-4"></v-divider>
                                    <div class="d-flex align-center">
                                        <v-skeleton-loader type="text" style="width: 100px;"></v-skeleton-loader>
                                        <v-spacer></v-spacer>
                                        <v-skeleton-loader type="button" class="skeleton-button-rounded"></v-skeleton-loader>
                                    </div>
                                </div>
                            </v-card>
                        </v-col>
                    </v-row>
                    
                    <v-row dense class="ma-0 pa-0" v-else>
                        <v-col v-for="definition in searchResults" :key="definition.id" cols="12" sm="6" md="4" class="mb-0 pa-2 pl-4">
                            <!-- 카테고리 표시 (모든 항목 표시) -->
                            <div class="category-label">
                                {{ getCategoryLabel(definition) }}
                            </div>
                            <v-card variant="outlined">
                                <v-img class="marketplace-image" height="140px" cover :src="definition.image || ''">
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
                                    <v-row class="ma-0 pa-0 align-center">
                                        <div class="text-body-1">{{ definition.author_name }}</div>
                                        <v-spacer></v-spacer>
                                        <v-btn 
                                            v-if="definition.author_uid === currentUserUid"
                                            @click="deleteDefinition(definition)" 
                                            color="error" 
                                            variant="flat"
                                            density="compact"
                                            class="mr-2"
                                            rounded="xl"
                                        >
                                            {{ $t('ProcessDefinitionMarketPlace.deleteButton') }}
                                        </v-btn>
                                        <v-btn 
                                            :disabled="definition.isImported"
                                            @click="importDefinition(definition)" 
                                            :color="definition.isImported ? 'grey' : 'primary'" 
                                            variant="flat"
                                            density="compact"
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
                    
                    <!-- 초기 로딩 중 스켈레톤 카드 -->
                    <v-row v-if="isLoading && definitionList.length === 0" dense class="pa-0 ma-0 pl-2 pr-2">
                        <v-col v-for="n in limit" :key="'skeleton-initial-' + n" cols="12" sm="6" md="4" class="mb-4 pa-2">
                            <v-card variant="outlined" class="skeleton-card">
                                <v-skeleton-loader type="image"></v-skeleton-loader>
                                <div class="pa-2">
                                    <v-skeleton-loader type="heading" class="mb-2"></v-skeleton-loader>
                                    <v-skeleton-loader type="text" class="mb-4"></v-skeleton-loader>
                                    <v-divider class="my-4"></v-divider>
                                    <div class="d-flex align-center">
                                        <v-skeleton-loader type="text" style="width: 100px;"></v-skeleton-loader>
                                        <v-spacer></v-spacer>
                                        <v-skeleton-loader type="button" class="skeleton-button-rounded"></v-skeleton-loader>
                                    </div>
                                </div>
                            </v-card>
                        </v-col>
                    </v-row>
                    
                    <v-row dense class="pa-0 ma-0 pl-2 pr-2">
                        <v-col v-for="definition in definitionList" :key="definition.id" cols="12" sm="6" md="4" class="mb-4 pa-2">
                            <!-- 카테고리 표시 -->
                            <div class="category-label">
                                {{ getCategoryLabel(definition) }}
                            </div>
                            <v-card variant="outlined">
                                <v-img 
                                    class="marketplace-image" 
                                    height="140px" 
                                    cover
                                    :src="definition.image || ''"
                                >
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
                                    <v-row class="ma-0 pa-0 align-center">
                                        <div class="text-body-1">{{ definition.author_name }}</div>
                                        <v-spacer></v-spacer>
                                        <v-btn 
                                            v-if="definition.author_uid === currentUserUid"
                                            @click="deleteDefinition(definition)" 
                                            color="error" 
                                            variant="flat"
                                            density="compact"
                                            class="mr-2"
                                            rounded="xl"
                                        >
                                            {{ $t('ProcessDefinitionMarketPlace.deleteButton') }}
                                        </v-btn>
                                        <v-btn 
                                            :disabled="definition.isImported"
                                            @click="importDefinition(definition)" 
                                            :color="definition.isImported ? 'grey' : 'primary'" 
                                            variant="flat"
                                            density="compact"
                                            rounded="xl"
                                        >
                                            {{ definition.isImported ? $t('ProcessDefinitionMarketPlace.addedButton') : $t('ProcessDefinitionMarketPlace.addButton') }}
                                        </v-btn>
                                    </v-row>
                                </div>
                            </v-card>
                        </v-col>
                    </v-row>
                    
                    <!-- 추가 로딩 중 스켈레톤 카드 -->
                    <v-row v-if="loadingMore" dense class="pa-0 ma-0 pl-2 pr-2">
                        <v-col v-for="n in limit" :key="'skeleton-' + n" cols="12" sm="6" md="4" class="mb-4 pa-2">
                            <v-card variant="outlined" class="skeleton-card">
                                <v-skeleton-loader type="image"></v-skeleton-loader>
                                <div class="pa-2">
                                    <v-skeleton-loader type="heading" class="mb-2"></v-skeleton-loader>
                                    <v-skeleton-loader type="text" class="mb-4"></v-skeleton-loader>
                                    <v-divider class="my-4"></v-divider>
                                    <div class="d-flex align-center">
                                        <v-skeleton-loader type="text" style="width: 100px;"></v-skeleton-loader>
                                        <v-spacer></v-spacer>
                                        <v-skeleton-loader type="button" class="skeleton-button-rounded"></v-skeleton-loader>
                                    </div>
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
                    
                    <!-- 태그 필터링 중 스켈레톤 카드 -->
                    <v-row dense class="pa-0 ma-0 pl-2 pr-2" v-if="isLoading">
                        <v-col v-for="n in 12" :key="'skeleton-tag-' + n" cols="12" sm="6" md="4" class="mb-4 pa-2">
                            <v-card variant="outlined" class="skeleton-card">
                                <v-skeleton-loader type="image"></v-skeleton-loader>
                                <div class="pa-2">
                                    <v-skeleton-loader type="heading" class="mb-2"></v-skeleton-loader>
                                    <v-skeleton-loader type="text" class="mb-4"></v-skeleton-loader>
                                    <v-divider class="my-4"></v-divider>
                                    <div class="d-flex align-center">
                                        <v-skeleton-loader type="text" style="width: 100px;"></v-skeleton-loader>
                                        <v-spacer></v-spacer>
                                        <v-skeleton-loader type="button" class="skeleton-button-rounded"></v-skeleton-loader>
                                    </div>
                                </div>
                            </v-card>
                        </v-col>
                    </v-row>
                    
                    <v-row dense class="pa-0 ma-0" v-else>
                        <v-col v-for="definition in filteredDefinitions" :key="definition.id" cols="12" sm="6" md="4" class="mb-0 pa-2 pl-4">
                            <!-- 카테고리 표시 (모든 항목 표시) -->
                            <div class="category-label">
                                {{ getCategoryLabel(definition) }}
                            </div>
                            <v-card variant="outlined">
                                <v-img class="marketplace-image" height="140px" cover :src="definition.image || ''">
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
                                    <v-row class="ma-0 pa-0 align-center">
                                        <div class="text-body-1">{{ definition.author_name }}</div>
                                        <v-spacer></v-spacer>
                                        <v-btn 
                                            v-if="definition.author_uid === currentUserUid"
                                            @click="deleteDefinition(definition)" 
                                            color="error" 
                                            variant="flat"
                                            density="compact"
                                            class="mr-2"
                                            rounded="xl"
                                        >
                                            {{ $t('ProcessDefinitionMarketPlace.deleteButton') }}
                                        </v-btn>
                                        <v-btn 
                                            :disabled="definition.isImported"
                                            @click="importDefinition(definition)" 
                                            :color="definition.isImported ? 'grey' : 'primary'" 
                                            variant="flat"
                                            density="compact"
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
        </div>
        
        <!-- 삭제 확인 다이얼로그 -->
        <v-dialog v-model="deleteDialog" max-width="500">
            <v-card>
                <v-row class="ma-0 pa-4 pb-0 align-center">
                    <v-card-title class="pa-0">
                        {{ $t('ProcessDefinitionMarketPlace.deleteDialogTitle') }}
                    </v-card-title>
                    <v-spacer></v-spacer>
                    <v-btn @click="cancelDelete"
                        class="ml-auto" 
                        variant="text" 
                        density="compact"
                        icon
                    >
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-row>
                <v-card-text class="pa-4">
                    <div class="mb-4">
                        <p class="text-body-1 mb-2">{{ $t('ProcessDefinitionMarketPlace.deleteDialogMessage', { name: definitionToDelete?.name }) }}</p>
                        <p class="text-body-2 text-error">{{ $t('ProcessDefinitionMarketPlace.deleteDialogWarning') }}</p>
                    </div>
                    <div class="mb-2">
                        <p class="text-body-2">{{ $t('ProcessDefinitionMarketPlace.deleteDialogConfirmMessage') }}</p>
                    </div>
                    <v-text-field
                        v-model="deleteConfirmName"
                        :placeholder="definitionToDelete?.name"
                        variant="outlined"
                        density="compact"
                        autofocus
                        hide-details
                    ></v-text-field>
                </v-card-text>
                <v-row class="ma-0 pa-4 pr-2 pt-0">
                    <v-spacer></v-spacer>
                    <v-btn @click="confirmDelete" 
                        color="error"
                        variant="flat"
                        class="rounded-pill"
                        :disabled="deleteConfirmName !== definitionToDelete?.name"
                    >{{ $t('ProcessDefinitionMarketPlace.deleteButton') }}
                    </v-btn>
                </v-row>
            </v-card>
        </v-dialog>
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
        lastSearchedKeyword: '',
        isSearching: false,
        searchResults: [],
        searchTimeout: null,
        currentSearchId: null,
        allTags: [],
        offset: 0,
        limit: 12,
        hasMore: true,
        loadingMore: false,
        currentUserUid: null,
        deleteDialog: false,
        definitionToDelete: null,
        deleteConfirmName: ''
    }),
    async mounted() {
        // 현재 로그인한 사용자 UID 가져오기
        const userInfo = await backend.getUserInfo();
        this.currentUserUid = userInfo?.uid;
        
        await Promise.all([
            this.getDefinitionList(),
            this.loadAllTags()
        ]);
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
            return !!this.lastSearchedKeyword;
        }
    },
    methods: {
        async getDefinitionList(reset = true) {
            if (reset) {
                this.isLoading = true;
                this.offset = 0;
                this.definitionList = [];
                this.hasMore = true;
            } else {
                this.loadingMore = true;
            }
            
            try {
                const list = await backend.listMarketplaceDefinition(undefined, false, this.limit, this.offset);
                
                if (!Array.isArray(list)) {
                    console.error('마켓플레이스 정의를 가져오는 중 오류 발생: list가 배열이 아닙니다');
                    return;
                }
                
                if (list.length < this.limit) {
                    this.hasMore = false;
                }
                
                const promises = list.map(async (definition) => {
                    let isImported = false;
                    try {
                        // proc_def에서 정확히 일치하거나 UUID 패턴(_UUID)으로 추가된 항목 확인
                        const { data } = await window.$supabase
                            .from('proc_def')
                            .select('id')
                            .like('id', `${definition.id}%`)
                            .eq('tenant_id', window.$tenantName);
                        
                        if (data && data.length > 0) {
                            // 정확히 일치하거나 UUID 패턴인지 확인
                            isImported = data.some(item => {
                                if (item.id === definition.id) return true;
                                // UUID 패턴: 원본ID_UUID (UUID는 하이픈 포함)
                                return item.id.startsWith(`${definition.id}_`) && item.id.includes('-');
                            });
                        }
                    } catch (err) {
                        console.error('마켓플레이스 항목 체크 중 오류:', err.message);
                    }
                    
                    let tags = [];
                    if (definition.tags) {
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
                
                const definitions = await Promise.all(promises);
                this.definitionList = [...this.definitionList, ...definitions];
                this.offset += this.limit;
                
                if (this.categories.length > 0) {
                    this.selectedTab = this.categories[0];
                }
            } catch (error) {
                console.error('마켓플레이스 정의를 가져오는 중 오류 발생:', error);
            } finally {
                this.isLoading = false;
                this.loadingMore = false;
            }
        },
        async loadMoreDefinitions() {
            if (!this.hasMore || this.loadingMore || this.isLoading) return;
            await this.getDefinitionList(false);
        },
        handleScroll(event) {
            const element = event.target;
            const scrollBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
            
            if (scrollBottom === 0 && !this.loadingMore && this.hasMore && !this.isLoading && this.selectedTag === 'all') {
                this.loadMoreDefinitions();
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
        deleteDefinition(definition) {
            this.definitionToDelete = definition;
            this.deleteConfirmName = '';
            this.deleteDialog = true;
        },
        cancelDelete() {
            this.deleteDialog = false;
            this.definitionToDelete = null;
            this.deleteConfirmName = '';
        },
        async confirmDelete() {
            const definition = this.definitionToDelete;
            this.deleteDialog = false;
            
            this.$try({
                action: async () => {
                    await backend.deleteMarketplaceDefinition(definition.id);
                    // 목록에서 제거
                    this.definitionList = this.definitionList.filter(d => d.id !== definition.id);
                    this.searchResults = this.searchResults.filter(d => d.id !== definition.id);
                    this.filteredDefinitions = this.filteredDefinitions.filter(d => d.id !== definition.id);
                    
                    // 초기화
                    this.definitionToDelete = null;
                    this.deleteConfirmName = '';
                },
                successMsg: '삭제되었습니다.'
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
            // allTags 배열 반환 (전체 태그 목록)
            return this.allTags;
        },
        async loadAllTags() {
            try {
                this.allTags = await backend.getAllMarketplaceTags();
            } catch (error) {
                console.error('태그 목록 로드 중 오류 발생:', error);
                this.allTags = [];
            }
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
                        let isImported = false;
                        try {
                            // proc_def에서 정확히 일치하거나 UUID 패턴(_UUID)으로 추가된 항목 확인
                            const { data } = await window.$supabase
                                .from('proc_def')
                                .select('id')
                                .like('id', `${definition.id}%`)
                                .eq('tenant_id', window.$tenantName);
                            
                            if (data && data.length > 0) {
                                // 정확히 일치하거나 UUID 패턴인지 확인
                                isImported = data.some(item => {
                                    if (item.id === definition.id) return true;
                                    // UUID 패턴: 원본ID_UUID (UUID는 하이픈 포함)
                                    return item.id.startsWith(`${definition.id}_`) && item.id.includes('-');
                                });
                            }
                        } catch (err) {
                            console.error('마켓플레이스 항목 체크 중 오류:', err.message);
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
        async onSearchChange() {
            const keyword = this.searchKeyword;
            
            // 검색어가 비어있으면 검색 모드 해제
            if (!keyword || keyword.trim() === '') {
                this.searchResults = [];
                this.lastSearchedKeyword = '';
                this.currentSearchId = null;
                return;
            }
            
            this.lastSearchedKeyword = keyword;
            this.isSearching = true;
            
            // 검색 시작 시 이전 결과 초기화
            this.searchResults = [];
            
            // 현재 검색의 고유 ID 생성
            const searchId = Date.now();
            this.currentSearchId = searchId;
            
            try {
                // 백엔드에서 검색 실행
                const results = await backend.listMarketplaceDefinition(keyword, true);
                
                // 이 검색이 가장 최근 검색이 아니면 무시
                if (this.currentSearchId !== searchId) {
                    return;
                }
                
                if (!results || !Array.isArray(results)) {
                    this.searchResults = [];
                    this.isSearching = false;
                    return;
                }
                
                const promises = results.map(async (definition) => {
                    if (!definition) return null;
                    
                    let isImported = false;
                    try {
                        // proc_def에서 정확히 일치하거나 UUID 패턴(_UUID)으로 추가된 항목 확인
                        const { data } = await window.$supabase
                            .from('proc_def')
                            .select('id')
                            .like('id', `${definition.id}%`)
                            .eq('tenant_id', window.$tenantName);
                        
                        if (data && data.length > 0) {
                            // 정확히 일치하거나 UUID 패턴인지 확인
                            isImported = data.some(item => {
                                if (item.id === definition.id) return true;
                                // UUID 패턴: 원본ID_UUID (UUID는 하이픈 포함)
                                return item.id.startsWith(`${definition.id}_`) && item.id.includes('-');
                            });
                        }
                    } catch (err) {
                        console.error('정의 불러오기 오류:', err.message);
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
                    
                    // 처리 완료 후 다시 한번 최신 검색인지 확인
                    if (this.currentSearchId !== searchId) {
                        return;
                    }
                    
                    // null 값 제거
                    this.searchResults = searchResults.filter(item => item !== null);
                } catch (err) {
                    console.error(`검색 결과 처리 오류: ${err.message}`);
                    if (this.currentSearchId === searchId) {
                        this.searchResults = [];
                    }
                }
            } catch (error) {
                console.error('검색 중 오류 발생:', error);
                if (this.currentSearchId === searchId) {
                    this.searchResults = [];
                }
            } finally {
                if (this.currentSearchId === searchId) {
                    this.isSearching = false;
                }
            }
        },
        // 16진수 이스케이프 문자열을 base64로 변환
        hexToBase64(hexString) {
            try {
                // \x 형식의 이스케이프된 16진수 문자열을 실제 문자로 변환
                const decoded = hexString.replace(/\\x([0-9A-Fa-f]{2})/g, 
                    (match, p1) => String.fromCharCode(parseInt(p1, 16))
                );
                return decoded;
            } catch (error) {
                console.error('이미지 디코딩 중 오류 발생:', error);
                return '';
            }
        }
    }
};
</script>

<style scoped>
.marketplace-scroll-area {
    max-height: calc(100vh - 56px);
    min-height: calc(100vh - 56px);
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
}

.skeleton-card {
    overflow: hidden;
}

.skeleton-button-rounded :deep(.v-skeleton-loader__button) {
    border-radius: 24px !important;
    width: 80px;
    height: 32px;
}
</style>

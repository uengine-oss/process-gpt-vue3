<template>
    <!-- 통합 용어 사전 — 프로세스별 용어 정의(glossary_terms)를 용어 단위로 묶어 보여준다.
         표준 페이지 구조 (SKGlobalStyle: sk-page-card / page-header / sk-page-card-text) -->
    <v-card flat class="sk-page-card">
        <div class="page-header">
            <div class="page-header-left">
                <h1 class="page-title">용어 사전</h1>
                <p class="page-subtitle">
                    프로세스별 용어 정의를 통합해 보여줍니다. 용어를 펼치면 어떤 프로세스에서 어떻게 정의해 쓰는지 확인할 수 있습니다.
                </p>
            </div>
            <div class="page-header-right">
                <v-btn size="small" variant="tonal" prepend-icon="mdi-refresh" :loading="store.loading" @click="reload">새로고침</v-btn>
            </div>
        </div>

        <v-card-text class="pa-4 pt-2 sk-page-card-text">
            <!-- 툴바 -->
            <div class="filter-row">
                <div class="filter-search-wrap">
                    <v-icon size="15" class="filter-search-icon">mdi-magnify</v-icon>
                    <input v-model="searchText" class="form-input filter-search" placeholder="용어 · 정의 · 프로세스명 검색" />
                </div>
                <span class="text-caption text-medium-emphasis ml-2"> 용어 {{ filteredGroups.length }}개 · 정의 {{ totalUsages }}건 </span>
            </div>

            <div class="glossary-scroll">
                <div v-if="store.loading && !store.allTermsLoaded" class="text-center pa-8">
                    <v-progress-circular indeterminate size="24" color="primary" />
                </div>

                <template v-else>
                    <div v-if="filteredGroups.length === 0" class="empty-note">
                        {{
                            searchText
                                ? '검색 결과가 없습니다.'
                                : '등록된 용어가 없습니다. 프로세스 속성패널의 "용어 정의" 섹션에서 용어를 등록해 보세요.'
                        }}
                    </div>

                    <div v-for="group in filteredGroups" :key="group.key" class="term-card">
                        <div class="term-card__head" @click="toggleGroup(group.key)">
                            <v-icon size="16" class="mr-1">
                                {{ isGroupOpen(group.key) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
                            </v-icon>
                            <span class="term-card__term">{{ group.term }}</span>
                            <v-chip size="x-small" variant="tonal" color="primary" class="ml-2">
                                {{ group.usages.length }}개 프로세스
                            </v-chip>
                            <span class="term-card__preview">{{ previewDefinition(group) }}</span>
                        </div>
                        <div v-show="isGroupOpen(group.key)" class="term-card__body">
                            <div v-for="usage in group.usages" :key="usage.id" class="usage-row">
                                <div class="usage-row__process">
                                    <v-icon size="13" class="mr-1" color="primary">mdi-file-tree</v-icon>
                                    <a class="usage-row__link" @click.prevent="openProcess(usage)">
                                        {{ usage.proc_def_name || usage.proc_def_id }}
                                    </a>
                                </div>
                                <div class="usage-row__definition">{{ usage.definition || '-' }}</div>
                            </div>
                        </div>
                    </div>
                </template>
            </div>
        </v-card-text>
    </v-card>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useGlossaryStore } from '@/stores/glossary';
import { navigateToProcessHierarchy, PROCESS_HIERARCHY_ENTRY } from '@/views/process-hierarchy/navigation';

const store = useGlossaryStore();
const router = useRouter();

const searchText = ref('');
const openGroups = ref(new Set());

const filteredGroups = computed(() => {
    const query = searchText.value.trim().toLowerCase();
    const groups = store.groupedTerms;
    if (!query) return groups;
    return groups.filter(
        (group) =>
            group.term.toLowerCase().includes(query) ||
            group.usages.some(
                (usage) =>
                    String(usage.definition || '')
                        .toLowerCase()
                        .includes(query) ||
                    String(usage.proc_def_name || '')
                        .toLowerCase()
                        .includes(query)
            )
    );
});

const totalUsages = computed(() => filteredGroups.value.reduce((sum, group) => sum + group.usages.length, 0));

const isGroupOpen = (key) => openGroups.value.has(key);
const toggleGroup = (key) => {
    const next = new Set(openGroups.value);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    openGroups.value = next;
};

// 접힌 상태에서 대표 정의 한 줄 미리보기
const previewDefinition = (group) => {
    const first = group.usages.find((usage) => String(usage.definition || '').trim());
    const text = String(first?.definition || '')
        .trim()
        .replace(/\s+/g, ' ');
    return text.length > 60 ? text.slice(0, 60) + '…' : text;
};

const openProcess = (usage) => {
    navigateToProcessHierarchy(router, {
        id: usage.proc_def_id,
        name: usage.proc_def_name || '',
        entry: PROCESS_HIERARCHY_ENTRY.DIRECT
    });
};

const reload = () => store.loadAllTerms(true);

onMounted(() => {
    store.loadAllTerms(true);
});
</script>

<style scoped>
.filter-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    margin-bottom: 12px;
}

.filter-search-wrap {
    position: relative;
    display: flex;
    align-items: center;
    min-width: 280px;
}

.filter-search-icon {
    position: absolute;
    left: 10px;
    color: #94a3b8;
}

.filter-search {
    width: 100%;
    padding: 7px 10px 7px 30px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 13px;
    outline: none;
    background: #fff;
}

.filter-search:focus {
    border-color: #94a3b8;
}

.glossary-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
}

.empty-note {
    padding: 48px 16px;
    text-align: center;
    color: #64748b;
    font-size: 13px;
}

.term-card {
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    margin-bottom: 10px;
    background: #fff;
    overflow: hidden;
}

.term-card__head {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    cursor: pointer;
    user-select: none;
    background: #fafafa;
    transition: background-color 0.15s;
    min-width: 0;
}

.term-card__head:hover {
    background: #f0f0f0;
}

.term-card__term {
    font-size: 14px;
    font-weight: 700;
    color: #1f2937;
    flex-shrink: 0;
}

.term-card__preview {
    margin-left: 12px;
    font-size: 12px;
    color: #94a3b8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
}

.term-card__body {
    border-top: 1px solid #e8e8e8;
    padding: 8px 12px;
}

.usage-row {
    padding: 8px 0;
}

.usage-row + .usage-row {
    border-top: 1px dashed #e8e8e8;
}

.usage-row__process {
    display: flex;
    align-items: center;
    margin-bottom: 2px;
}

.usage-row__link {
    font-size: 12px;
    font-weight: 600;
    color: #2563eb;
    cursor: pointer;
}

.usage-row__link:hover {
    text-decoration: underline;
}

.usage-row__definition {
    font-size: 13px;
    line-height: 1.6;
    color: #374151;
    white-space: pre-wrap;
    word-break: break-word;
}
</style>

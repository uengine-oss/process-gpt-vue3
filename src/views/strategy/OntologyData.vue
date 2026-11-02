<script setup lang="ts">
// 온톨로지 데이터 — Process-GPT 와 Ontology Studio 의 데이터 연동 화면(spec 020).
// ① 데이터셋: 판단 단계 에이전트가 근거로 쓰는 Studio 데이터·학습 정의를 보고 조정
// ② Studio 데이터: Studio 스키마·클래스·행을 Process-GPT 안에서 둘러보기
// ③ 실행 이력 연동: 프로세스 정의·인스턴스·업무(폼 값)를 Studio 로 보내 분석에 사용
// ④ 연관 관계: 실행 이력 폼 값 ↔ Studio 업무 데이터 연결 규칙, 단계별 데이터 사용(spec 021)
// 전략 보드·온톨로지 익스플로러처럼 모든 모드에서 연다(013 예외 규칙). PAL 은 공통 박스 레이아웃으로 감싼다.
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DatasetTab from './ontology-data/DatasetTab.vue';
import StudioBrowserTab from './ontology-data/StudioBrowserTab.vue';
import ExportTab from './ontology-data/ExportTab.vue';
import LinksTab from './ontology-data/LinksTab.vue';

const route = useRoute();
const router = useRouter();
const isPal = !!(window as any).$pal;

type Tab = 'datasets' | 'studio' | 'export' | 'links';
const TABS: Tab[] = ['datasets', 'studio', 'export', 'links'];
const tab = ref<Tab>(TABS.includes(route.query.tab as Tab) ? (route.query.tab as Tab) : 'datasets');
// 익스플로러(전략 보드) Studio 데이터 열에서 넘어올 때: ?proc=&act= 로 그 데이터셋을 연다
const focus = ref<{ proc?: string; act?: string; newClass?: string } | null>(
    route.query.proc ? { proc: String(route.query.proc), act: route.query.act ? String(route.query.act) : undefined } : null
);

watch(tab, (t) => {
    if (route.query.tab !== t) router.replace({ query: { ...route.query, tab: t } });
});

function useClass(cls: string) {
    focus.value = { newClass: cls };
    tab.value = 'datasets';
}
</script>

<template>
    <!-- Strategy Board 와 같은 페이지 박스(모든 모드). PAL 은 sk-page-card + page-header, 비 PAL 은 기존 헤더 -->
    <v-card
        :elevation="isPal ? 10 : 0"
        class="ontology-data-page"
        :class="{ 'rounded-xl sk-page-card': isPal }"
        :style="{ height: isPal ? '100%' : 'calc(100vh - 132px)' }"
    >
        <div
            class="ontology-data-header"
            :class="isPal ? 'page-header pa-0 mb-4' : 'd-flex align-center justify-space-between mb-4 flex-wrap ga-2'"
        >
            <div v-if="isPal" class="page-header-left">
                <h1 class="page-title">온톨로지 데이터</h1>
                <p class="page-subtitle">에이전트 판단의 근거 데이터셋 · Ontology Studio 데이터 · 실행 이력 연동 · 연관 관계</p>
            </div>
            <div v-else>
                <h2 class="text-h5 font-weight-bold">온톨로지 데이터</h2>
                <span class="text-caption text-medium-emphasis">에이전트 판단의 근거 데이터셋 · Ontology Studio 데이터 · 실행 이력 연동 · 연관 관계</span>
            </div>
            <div :class="isPal ? 'page-header-right' : ''">
                <v-btn variant="outlined" size="small" @click="router.push('/strategy-board?view=explorer')">
                    <v-icon start size="16">mdi-graph-outline</v-icon>온톨로지 익스플로러
                </v-btn>
            </div>
        </div>

        <v-tabs v-model="tab" density="compact" class="mb-3">
            <v-tab value="datasets"><v-icon start size="18">mdi-table-cog</v-icon>데이터셋</v-tab>
            <v-tab value="studio"><v-icon start size="18">mdi-database-search-outline</v-icon>Studio 데이터</v-tab>
            <v-tab value="export"><v-icon start size="18">mdi-upload-network-outline</v-icon>실행 이력 연동</v-tab>
            <v-tab value="links"><v-icon start size="18">mdi-vector-link</v-icon>연관 관계</v-tab>
        </v-tabs>
        <v-window v-model="tab" class="ontology-data-window">
            <v-window-item value="datasets">
                <DatasetTab :focus="focus" />
            </v-window-item>
            <v-window-item value="studio">
                <StudioBrowserTab v-if="tab === 'studio'" :initial-class="route.query.cls ? String(route.query.cls) : undefined" @use-class="useClass" />
            </v-window-item>
            <v-window-item value="export">
                <ExportTab v-if="tab === 'export'" @browse="tab = 'studio'" @use-class="useClass" />
            </v-window-item>
            <v-window-item value="links">
                <LinksTab v-if="tab === 'links'" @browse="tab = 'studio'" />
            </v-window-item>
        </v-window>
    </v-card>
</template>

<style scoped>
/* Strategy Board 와 같은 박스 — 카드 안에서만 스크롤 */
.ontology-data-page.ontology-data-page {
    display: flex !important;
    flex-direction: column !important;
    overflow: auto !important;
    padding: 16px;
}
.ontology-data-header {
    flex-shrink: 0;
}
.ontology-data-window {
    flex: 1;
    min-height: 0;
}
</style>

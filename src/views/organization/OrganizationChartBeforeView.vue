<template>
    <v-card elevation="10" class="rounded-xl sk-page-card org-before-page">
        <!-- ───────────── 페이지 헤더 ───────────── -->
        <div class="page-header">
            <div class="page-header-left">
                <h1 class="page-title">조직도-before</h1>
                <p class="page-subtitle">개편 전 조직도 화면 — 현재 조직도와 같은 데이터를 읽기 전용으로 표시합니다.</p>
            </div>
            <div class="page-header-right">
                <div class="org-before-status">
                    <v-icon size="14">mdi-eye-outline</v-icon>
                    <span>읽기 전용</span>
                </div>
                <v-btn size="small" variant="tonal" class="text-none" prepend-icon="mdi-sitemap" to="/organization"> 현재 조직도 </v-btn>
            </div>
        </div>

        <!-- ───────────── 기존 조직도 화면 (읽기 전용) ───────────── -->
        <div class="org-before-body">
            <OrganizationChartChat readonly />
        </div>
    </v-card>
</template>

<script setup lang="ts">
/**
 * 조직도-before (PAL 모드 전용)
 *
 * 개편 전 조직도 화면(`components/OrganizationChartChat.vue`)을 읽기 전용으로 그대로 띄운다.
 * 저장소는 개편된 조직도와 동일한 `configuration` (key='organization') 의 `value.chart` 를
 * 공유하므로 별도 데이터 이관 없이 현재 조직도 데이터가 그대로 보인다.
 * 읽기 전용이라 이 화면에서의 조작이 개편된 조직도 데이터를 덮어쓰지 않는다.
 */
import OrganizationChartChat from '@/components/OrganizationChartChat.vue';
</script>

<style scoped>
/* PAL 공통 디자인 시스템(SKGlobalStyle.scss)의 sk-page-card / page-header 를 그대로 사용한다.
   sk-page-card 의 height:100% 는 부모(page-wrapper) 높이가 auto 라 계산되지 않아 뷰포트 기준으로 잡는다. */
.org-before-page {
    height: calc(100vh - 40px) !important;
    min-height: 460px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.page-header-right {
    display: flex;
    align-items: center;
    gap: 12px;
}

.org-before-status {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: rgb(var(--v-theme-textSecondary, 100, 116, 139));
}

.org-before-body {
    flex: 1 1 auto;
    min-height: 0;
    position: relative;
}

@media (max-width: 768px) {
    .org-before-page {
        height: calc(100vh - 24px) !important;
    }
}
</style>

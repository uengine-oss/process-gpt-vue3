<template>
    <!-- 미설치 — 전면 안내 카드 (FR-014, SC-005) -->
    <div v-if="state === 'notInstalled'" class="hb-card hb-block">
        <div class="hb-title">온톨로지 그래프가 설치되지 않았습니다</div>
        <p>
            Apache AGE 그래프 <code>process_gpt</code>(스키마 0.2.x)가 이 환경의 데이터베이스에 없습니다. 아래 절차로 설치한 뒤
            새로고침하세요.
        </p>
        <ol>
            <li><code>DATABASE_URL=... scripts/install-ontology-graph.sh</code> — 스키마 설치 (supabase_admin 계정)</li>
            <li>
                <code>node scripts/seed-ontology-graph.mjs --tenant &lt;TENANT&gt; --demo-strategy --demo-skills</code>
                — 투영·데모 시드
            </li>
            <li><code>supabase/migrations/20260710_ontology_explorer_rpc.sql</code> 적용 — 읽기 RPC</li>
        </ol>
        <p class="hb-dim">상세: specs/005-ontology-explorer-new/quickstart.md</p>
    </div>

    <!-- 버전 불일치 — 렌더 중단 경고 (V4) -->
    <div v-else-if="state === 'incompatible'" class="hb-card hb-block hb-error">
        <div class="hb-title">스키마 버전 호환 불가 — 그래프 표시를 중단했습니다</div>
        <p>
            배포된 그래프 스키마 <b>{{ health?.schemaVersion ?? '알 수 없음' }}</b> 이(가) 이 화면이 아는 계약 <b>0.2.x</b> 와 다릅니다.
            스키마 계약(SCHEMA.md)을 확인하고 화면 또는 그래프를 갱신하세요.
        </p>
    </div>

    <!-- 로드 오류 -->
    <div v-else-if="state === 'error'" class="hb-card hb-block hb-error">
        <div class="hb-title">온톨로지 그래프 조회 실패</div>
        <p>{{ errorMessage }}</p>
    </div>

    <!-- 정상이지만 dangling 존재 — 전략-실행 정합성 경보 (배너) -->
    <div v-else-if="state === 'ready' && (health?.danglingCount ?? 0) > 0" class="hb-card hb-warn">
        미해소 참조(dangling) {{ health!.danglingCount }}건 — 전략-실행 정합성 경보입니다. 동기화/시드 로그를 확인하세요.
    </div>
</template>

<script setup lang="ts">
import type { GraphHealth, HealthState } from '@/composables/ontologyNew/types';

defineProps<{
    state: HealthState;
    health: GraphHealth | null;
    errorMessage?: string | null;
}>();
</script>

<style scoped>
.hb-card {
    border-radius: 10px;
    padding: 14px 18px;
    font-size: 13px;
    color: #334155;
    border: 1px solid #e2e8f0;
    background: #fff;
}
.hb-block {
    max-width: 640px;
    margin: 48px auto;
    padding: 24px 28px;
}
.hb-title {
    font-weight: 700;
    font-size: 15px;
    margin-bottom: 8px;
}
.hb-error {
    border-color: #fecaca;
    background: #fef2f2;
    color: #991b1b;
}
.hb-warn {
    border-color: #fde68a;
    background: #fffbeb;
    color: #92400e;
    margin: 8px 12px;
}
.hb-dim {
    color: #94a3b8;
    font-size: 12px;
}
code {
    background: #f1f5f9;
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 12px;
}
ol {
    margin: 8px 0 8px 18px;
    display: grid;
    gap: 4px;
}
</style>

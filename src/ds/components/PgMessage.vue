<template>
    <!-- 사용자 발화: 우측 정렬 말풍선 -->
    <div v-if="role === 'user'" class="pg-msg-user">
        <div class="pg-msg-user__bubble"><slot /></div>
        <div v-if="$slots.actions" class="pg-msg__actions"><slot name="actions" /></div>
    </div>

    <!-- 어시스턴트 응답: 세리프 본문 -->
    <div v-else class="pg-msg-assistant">
        <div v-if="thinking" class="pg-msg-thinking">{{ thinking }}</div>
        <div class="pg-msg-assistant__body"><slot /></div>
        <div v-if="$slots.actions" class="pg-msg__actions"><slot name="actions" /></div>
    </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ role?: 'user' | 'assistant'; thinking?: string }>(), { role: 'assistant' });
</script>

<script lang="ts">
export default { name: 'PgMessage' };
</script>

<style scoped>
/* --- 사용자 말풍선: radius 12, padding 10/16, max-width 85% --- */
.pg-msg-user {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
}
.pg-msg-user__bubble {
    max-width: 85%;
    padding: 10px 16px;
    border-radius: var(--cds-radius-bubble);
    background: hsl(var(--bg-300));
    color: var(--cds-text-primary);
    font-size: var(--cds-font-size-body--lg);
    font-weight: 430;
    line-height: 22px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;

    /* 원본 cds-um-enter */
    animation: pg-bubble-enter 0.45s var(--cds-ease-overshoot) both;
}
@keyframes pg-bubble-enter {
    from {
        opacity: 0;
        transform: scale(0.92) translateY(6px);
    }
    to {
        opacity: 1;
        transform: none;
    }
}

/* --- 응답 본문: 세리프 16px / line-height 26.4px --- */
.pg-msg-assistant {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.pg-msg-assistant__body {
    font-family: var(--cds-font-voice);
    font-size: 16px;
    line-height: 26.4px;
    color: var(--cds-text-primary);
}

.pg-msg-thinking {
    margin-bottom: 8px;
    color: var(--cds-text-muted);
    font-size: var(--cds-font-size-body--lg);
    line-height: 24px;
}

.pg-msg__actions {
    display: flex;
    gap: 2px;
    padding-left: 4px;
    margin-top: 4px;
}

/* 응답 본문 내부 마크다운 — 원본 리듬 유지 */
.pg-msg-assistant__body :deep(p) {
    margin: 0 0 24px;
}
.pg-msg-assistant__body :deep(> :last-child) {
    margin-bottom: 0;
}
.pg-msg-assistant__body :deep(strong) {
    font-weight: var(--cds-font-weight-bold);
}
.pg-msg-assistant__body :deep(h1),
.pg-msg-assistant__body :deep(h2),
.pg-msg-assistant__body :deep(h3) {
    margin: 1.5em 0 0.6em;
    font-weight: var(--cds-font-weight-semibold);
    line-height: 1.35;
}
.pg-msg-assistant__body :deep(ul),
.pg-msg-assistant__body :deep(ol) {
    margin: 0 0 1em;
    padding-left: 1.75rem;
}
.pg-msg-assistant__body :deep(li) {
    margin: 0.25em 0;
}

/* 인라인 코드 — 실측: 글자 #8e2626, 배경 검정 5% */
.pg-msg-assistant__body :deep(:not(pre) > code) {
    padding: 1px 5px;
    border-radius: 5px;
    background: var(--cds-bg-neutral);
    color: var(--cds-text-danger);
    font-family: var(--cds-font-mono);
    font-size: 0.85em;
}

/* 표 — th 0.5px@60%, td 0.5px@30% */
.pg-msg-assistant__body :deep(table) {
    width: 100%;
    margin: 0 0 24px;
    border-collapse: collapse;
    font-family: var(--cds-font-sans);
    font-size: var(--cds-font-size-body);
    line-height: var(--cds-leading-body);
}
.pg-msg-assistant__body :deep(th),
.pg-msg-assistant__body :deep(td) {
    padding: 8px 16px 8px 0;
    vertical-align: top;
    text-align: left;
}
.pg-msg-assistant__body :deep(th) {
    border-bottom: 0.5px solid hsl(var(--border-300) / 60%);
    font-weight: var(--cds-font-weight-semibold);
}
.pg-msg-assistant__body :deep(td) {
    border-bottom: 0.5px solid hsl(var(--border-300) / 30%);
}

@media (prefers-reduced-motion: reduce) {
    .pg-msg-user__bubble {
        animation: none;
    }
}
</style>

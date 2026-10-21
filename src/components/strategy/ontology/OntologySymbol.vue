<script setup lang="ts">
// 상태 기호 — 상태를 색만이 아니라 모양으로도 구분한다(▲ 위험·병목, ◆ 주의·지연, ○ 실행 미연결, ◎ 코스).
withDefaults(defineProps<{ kind: 'risk' | 'warn' | 'unlinked' | 'course'; size?: number; label?: string }>(), { size: 12, label: '' });
</script>

<template>
    <svg
        class="osym"
        :width="size"
        :height="size"
        viewBox="0 0 12 12"
        :role="label ? 'img' : undefined"
        :aria-label="label || undefined"
        :aria-hidden="label ? undefined : 'true'"
    >
        <path v-if="kind === 'risk'" d="M6 0.8 L11.4 11 H0.6 Z" style="fill: var(--sx-risk, #dc2626)" />
        <path v-else-if="kind === 'warn'" d="M6 0.6 L11.4 6 L6 11.4 L0.6 6 Z" style="fill: var(--sx-warn, #b45309)" />
        <circle
            v-else-if="kind === 'unlinked'"
            cx="6"
            cy="6"
            r="4.4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-dasharray="2 1.6"
        />
        <g v-else>
            <circle cx="6" cy="6" r="4.6" fill="none" style="stroke: var(--sx-course, #6d28d9)" stroke-width="2" />
        </g>
    </svg>
</template>

<style scoped>
.osym {
    flex-shrink: 0;
    display: inline-block;
    vertical-align: -1px;
}
</style>

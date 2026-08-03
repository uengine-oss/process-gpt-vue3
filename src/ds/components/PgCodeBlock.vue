<template>
    <div class="pg-code">
        <div class="pg-code__head">
            <span class="pg-code__lang">{{ lang }}</span>
            <button class="pg-code__copy" type="button" @click="copy">
                <PgIcon :name="copied ? 'mdi-check' : 'mdi-content-copy'" :size="13" />
                {{ copied ? '복사됨' : '복사' }}
            </button>
        </div>
        <div class="pg-code__scroll">
            <pre><code><slot>{{ code }}</slot></code></pre>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import PgIcon from './PgIcon.vue';

const props = withDefaults(defineProps<{ code?: string; lang?: string }>(), { code: '', lang: 'text' });
const copied = ref(false);

async function copy() {
    try {
        await navigator.clipboard.writeText(props.code);
        copied.value = true;
        setTimeout(() => (copied.value = false), 1500);
    } catch {
        /* 클립보드 권한이 없으면 조용히 무시 */
    }
}
</script>

<script lang="ts">
export default { name: 'PgCodeBlock' };
</script>

<style scoped>
/* 실측: radius 8, border 0.5px 헤어라인, 배경 흰색 50%, 14px/22.75px */
.pg-code {
    border: 0.5px solid var(--cds-border);
    border-radius: var(--cds-radius);
    background: color-mix(in srgb, var(--cds-surface-2) 50%, transparent);
    overflow: hidden;
}
.pg-code__head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-bottom: 0.5px solid var(--cds-border);
}
.pg-code__lang {
    flex: 1 1 auto;
    color: var(--cds-text-muted);
    font-family: var(--cds-font-mono);
    font-size: var(--cds-font-size-caption);
}
.pg-code__copy {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border: 0;
    border-radius: var(--cds-radius--xs);
    background: transparent;
    color: var(--cds-text-muted);
    font-family: var(--cds-font-sans);
    font-size: var(--cds-font-size-caption);
    cursor: pointer;
}
.pg-code__copy:hover {
    background: var(--cds-bg-neutral);
    color: var(--cds-text-primary);
}

.pg-code__scroll { overflow-x: auto; }
.pg-code pre {
    margin: 0;
    padding: 12px 14px;
    color: var(--cds-code-fg);
    font-family: var(--cds-font-mono);
    font-size: 14px;
    line-height: 22.75px;
}
.pg-code code { font: inherit; color: inherit; }
</style>

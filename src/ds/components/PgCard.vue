<template>
    <component :is="interactive ? 'button' : 'div'" class="pg-card" :class="[`pg-card--${elevation}`, { 'pg-card--interactive': interactive, 'pg-card--flush': flush }]" v-bind="$attrs">
        <header v-if="$slots.header || title" class="pg-card__header">
            <slot name="header">
                <div class="pg-card__titles">
                    <div class="pg-card__title">{{ title }}</div>
                    <div v-if="subtitle" class="pg-card__subtitle">{{ subtitle }}</div>
                </div>
                <div v-if="$slots.actions" class="pg-card__header-actions"><slot name="actions" /></div>
            </slot>
        </header>

        <div class="pg-card__body"><slot /></div>

        <footer v-if="$slots.footer" class="pg-card__footer"><slot name="footer" /></footer>
    </component>
</template>

<script setup lang="ts">
withDefaults(
    defineProps<{
        title?: string;
        subtitle?: string;
        /** hairline = 테두리만, raised = 그림자 */
        elevation?: 'flat' | 'hairline' | 'raised';
        /** 클릭 가능한 카드 (button 으로 렌더) */
        interactive?: boolean;
        /** 내부 패딩 제거 */
        flush?: boolean;
    }>(),
    { elevation: 'hairline', interactive: false, flush: false }
);
</script>

<script lang="ts">
export default { name: 'PgCard', inheritAttrs: false };
</script>

<style scoped>
.pg-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: var(--cds-radius);
    background: var(--cds-surface-2);
    color: var(--cds-text-primary);
    font: inherit;
    text-align: left;
    overflow: hidden;
}

.pg-card--hairline {
    border: 0.5px solid var(--cds-border);
}
.pg-card--raised {
    border: 0.5px solid var(--cds-border);
    box-shadow: var(--cds-shadow-sm);
}

.pg-card--interactive {
    cursor: pointer;
    transition: background-color 300ms var(--cds-ease-out), border-color 300ms var(--cds-ease-out),
        box-shadow 300ms var(--cds-ease-out);
}
.pg-card--interactive:hover {
    border-color: var(--cds-border-strong);
    box-shadow: var(--cds-shadow-sm);
}
.pg-card--interactive:focus-visible {
    outline: 2px solid hsl(var(--accent-100));
    outline-offset: 1px;
}

.pg-card__header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px 16px 0;
}
.pg-card__titles {
    min-width: 0;
    flex: 1 1 auto;
}
.pg-card__title {
    font-size: var(--cds-font-size-heading);
    line-height: var(--cds-leading-heading);
    font-weight: var(--cds-font-weight-semibold);
}
.pg-card__subtitle {
    margin-top: 2px;
    color: var(--cds-text-muted);
    font-size: var(--cds-font-size-footnote);
    line-height: var(--cds-leading-footnote);
}
.pg-card__header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}

.pg-card__body {
    padding: 16px;
    flex: 1 1 auto;
    min-height: 0;
}
.pg-card--flush .pg-card__body {
    padding: 0;
}

.pg-card__footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 16px 16px;
}
</style>

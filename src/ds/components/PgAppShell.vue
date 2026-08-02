<template>
    <div class="pg-app" :class="{ 'pg-app--collapsed': collapsed }">
        <aside class="pg-app__sidebar" :aria-hidden="collapsed ? 'true' : undefined">
            <slot name="sidebar" />
        </aside>

        <main class="pg-app__main">
            <header v-if="$slots.topbar" class="pg-app__topbar">
                <slot name="topbar" />
            </header>
            <div class="pg-app__content">
                <slot />
            </div>
        </main>

        <aside v-if="$slots.panel" class="pg-app__panel">
            <slot name="panel" />
        </aside>
    </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ collapsed?: boolean }>(), { collapsed: false });
</script>

<script lang="ts">
export default { name: 'PgAppShell' };
</script>

<style scoped>
/* 사이드바 272px 고정 + 본문 가변 (+ 선택적 우측 산출물 패널 565px) */
.pg-app {
    display: grid;
    grid-template-columns: var(--app-sidebar-w) minmax(0, 1fr);
    height: 100%;
    background: var(--cds-surface-0);
    color: var(--cds-text-primary);
}
.pg-app:has(.pg-app__panel) {
    grid-template-columns: var(--app-sidebar-w) minmax(0, 1fr) 565px;
}
.pg-app--collapsed {
    grid-template-columns: 0 minmax(0, 1fr);
}
.pg-app--collapsed:has(.pg-app__panel) {
    grid-template-columns: 0 minmax(0, 1fr) 565px;
}

.pg-app__sidebar {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    border-right: 0.5px solid var(--cds-border);
    transition: opacity 160ms var(--cds-ease-out);
}
.pg-app--collapsed .pg-app__sidebar {
    opacity: 0;
    pointer-events: none;
}

.pg-app__main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
}

.pg-app__topbar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 52px;
    padding: 0 16px;
    flex: 0 0 auto;
}

.pg-app__content {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    min-height: 0;
}

/* 산출물 패널 — 실측: bg surface-1, radius 8, margin 8px 8px 8px 0 */
.pg-app__panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    margin: 8px 8px 8px 0;
    border-radius: var(--cds-radius);
    background: var(--cds-surface-1);
    box-shadow: 0 0 0 1px rgb(0 0 0 / 6%), 0 4px 24px rgb(0 0 0 / 4%);
    overflow: hidden;
}

@media (max-width: 900px) {
    .pg-app,
    .pg-app:has(.pg-app__panel) {
        grid-template-columns: minmax(0, 1fr);
    }
    .pg-app__sidebar,
    .pg-app__panel {
        display: none;
    }
}
</style>

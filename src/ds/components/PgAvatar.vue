<template>
    <span class="pg-avatar" :class="`pg-avatar--${size}`" :style="style" :title="name">
        <img v-if="src" class="pg-avatar__img" :src="src" :alt="name || ''" @error="broken = true" />
        <span v-else class="pg-avatar__initials">{{ initials }}</span>
    </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = withDefaults(
    defineProps<{ name?: string; src?: string; size?: 'xs' | 'sm' | 'md' | 'lg'; color?: string }>(),
    { size: 'md' }
);

const broken = ref(false);
watch(() => props.src, () => (broken.value = false));

const src = computed(() => (broken.value ? undefined : props.src));

const initials = computed(() => {
    const n = (props.name || '').trim();
    if (!n) return '?';
    // 한글은 첫 글자, 라틴은 단어 이니셜 두 글자
    if (/[가-힣]/.test(n)) return n.slice(0, 1);
    return n
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();
});

/** 이름을 안정적인 색으로 매핑 (같은 사람은 항상 같은 색) */
const style = computed(() => {
    if (props.color) return { background: props.color };
    const n = props.name || '';
    let hash = 0;
    for (let i = 0; i < n.length; i++) hash = (hash * 31 + n.charCodeAt(i)) % 360;
    return { background: `hsl(${hash} 42% 62%)` };
});
</script>

<script lang="ts">
export default { name: 'PgAvatar' };
</script>

<style scoped>
.pg-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    border-radius: 50%;
    overflow: hidden;
    color: #fff;
    font-weight: var(--cds-font-weight-medium);
    line-height: 1;
    user-select: none;
}
.pg-avatar--xs {
    width: 20px;
    height: 20px;
    font-size: 10px;
}
.pg-avatar--sm {
    width: 24px;
    height: 24px;
    font-size: 11px;
}
.pg-avatar--md {
    width: 32px;
    height: 32px;
    font-size: 13px;
}
.pg-avatar--lg {
    width: 40px;
    height: 40px;
    font-size: 15px;
}

.pg-avatar__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
</style>

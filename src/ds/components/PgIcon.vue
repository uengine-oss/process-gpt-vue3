<template>
    <i class="pg-icon" :class="iconClass" :style="style" aria-hidden="true" />
</template>

<script setup lang="ts">
import { computed } from 'vue';

/**
 * MDI 웹폰트 기반 아이콘.
 * index.html 이 이미 materialdesignicons.min.css 를 로드하므로 새 의존성이 없고,
 * 기존 코드에서 쓰던 `mdi-account` 같은 이름을 그대로 받는다.
 */
const props = withDefaults(
    defineProps<{
        /** `mdi-account` 또는 접두어 없는 `account` 둘 다 허용 */
        name: string;
        /** px 단위 글자 크기 */
        size?: number | string;
        color?: string;
        /** 회전 애니메이션 */
        spin?: boolean;
    }>(),
    { size: 18, color: undefined, spin: false }
);

const iconClass = computed(() => [
    'mdi',
    props.name.startsWith('mdi-') ? props.name : `mdi-${props.name}`,
    { 'pg-icon--spin': props.spin }
]);

const style = computed(() => ({
    fontSize: typeof props.size === 'number' ? `${props.size}px` : props.size,
    color: props.color
}));
</script>

<script lang="ts">
export default { name: 'PgIcon' };
</script>

<style scoped>
.pg-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    line-height: 1;
    vertical-align: middle;
}
.pg-icon--spin {
    animation: pg-icon-spin 1.1s linear infinite;
}
@keyframes pg-icon-spin {
    to {
        transform: rotate(360deg);
    }
}
@media (prefers-reduced-motion: reduce) {
    .pg-icon--spin {
        animation: none;
    }
}
</style>

<template>
    <div class="no-access">
        <v-icon size="64" color="grey">mdi-shield-lock-outline</v-icon>
        <h3>{{ headline }}</h3>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ROLE_META, type RoleType } from '@/utils/roles';

const props = defineProps<{
    requiredRole?: RoleType | null;
}>();

const headline = computed(() => {
    if (props.requiredRole) {
        const label = ROLE_META[props.requiredRole]?.labelEn ?? props.requiredRole;
        return `${label} 이상 권한이 필요한 페이지입니다`;
    }
    return '관리자만 접근할 수 있는 페이지입니다';
});
</script>

<style scoped>
.no-access {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 20px;
    gap: 16px;
    color: #6b7280;
}

.no-access h3 {
    font-size: 18px;
    color: #374151;
    margin: 0;
}
</style>

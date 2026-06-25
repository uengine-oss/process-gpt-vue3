<template>
    <div class="logo">
        <RouterLink to="/" class="brand">
            <img src="/images/chat-icon.png" alt="" class="brand-icon" />
            <span class="brand-text">{{ brandName }}</span>
        </RouterLink>
    </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';

const brandName = (window as any)._env_?.VITE_BRAND_NAME || import.meta.env.VITE_BRAND_NAME || 'Process GPT';
</script>

<style scoped>
.brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
}
.brand-icon {
    width: 30px;
    height: 30px;
    object-fit: contain;
    flex: 0 0 auto;
}
.brand-text {
    font-size: 21px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: #ffffff;
    white-space: nowrap;
    line-height: 1.6;
}
</style>

<template>
    <div class="logo">
        <RouterLink to="/definition-map" class="brand">
            <template v-if="mode == 'ProcessGPT'">
                <img src="/images/chat-icon.png" alt="" class="brand-icon" />
                <span class="brand-text">{{ brandName }}</span>
            </template>
            <img v-else :src="uEngine6Logo" alt="home" style="width: 160px" />
        </RouterLink>
    </div>
</template>

<script>
import { RouterLink } from 'vue-router';
import uEngine6Logo from '@/assets/images/logos/uEngine6-logo.png';

export default {
    components: {
        RouterLink
    },
    data() {
        return {
            uEngine6Logo,
            mode: window.$mode,
            brandName: window._env_?.VITE_BRAND_NAME || import.meta.env.VITE_BRAND_NAME || 'Process GPT'
        };
    }
};
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
    color: #233044;
    white-space: nowrap;
    line-height: 1.6;
}
</style>

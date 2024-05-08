<script setup lang="ts">
import Logo from '@/layouts/full/logo/Logo.vue';
/* Register form */
import TenantRegister from '@/components/tenant/TenantRegister.vue';
</script>

<template>
    <div class="pa-3">
        <v-row class="h-100vh mh-100 auth">
            <v-col cols="12" lg="7" xl="8"
                class="d-lg-flex align-center justify-center authentication position-relative">
                <div class="auth-header pt-lg-6 pt-2 px-sm-6 px-3 pb-lg-6 pb-0">
                    <div class="position-relative">
                        <Logo />
                    </div>
                </div>
                <div class="">
                    <img src="@/assets/images/backgrounds/login-bg.svg" height="450" class="position-relative d-none d-lg-flex"
                        alt="login-background" />
                </div>
            </v-col>
            <v-col cols="12" lg="5" xl="4" class="d-flex align-center justify-center bg-surface">
                <div class="mt-xl-0 mt-5 mw-100 w-50" >
                    <h2 class="text-h3 font-weight-semibold mb-4" style="text-align: center;">{{ 'Create Tenant' }}</h2>
                    <TenantRegister />
                </div>
            </v-col>
        </v-row>
    </div>
</template>

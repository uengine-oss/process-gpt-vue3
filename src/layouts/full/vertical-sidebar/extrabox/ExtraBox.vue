<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import { Icon } from '@iconify/vue';

const authStore = useAuthStore();

const name = localStorage.getItem("userName");
const picture = localStorage.getItem("picture");
const isAdmin = localStorage.getItem("isAdmin");
</script>

<template>
    <v-sheet rounded="md" color="lightprimary" class="pa-4  ExtraBox hide-menu">
        <div class="d-flex align-center justify-space-between">
            <v-avatar size="50">
                <v-img :src="picture" width="50" />
            </v-avatar>
            <div>
                <h6 class="text-h6 d-flex align-center font-weight-semibold">{{ name }}</h6>
                <span class="text-subtitle-2 font-weight-medium text-grey100">
                    {{ isAdmin == 'true' ? 'Admin' : '' }}
                </span>
            </div>
            <div>
                <v-tooltip :text="$t('ExtraBox.logOut')">
                    <template v-slot:activator="{ props }">
                        <v-btn icon class="bg-lightprimary" flat  size="small" @click="authStore.logout()" v-bind="props">
                            <Icon icon="solar:logout-linear" class="text-primary" stroke-width="3" height="24" width="24" />
                        </v-btn>
                    </template>
                </v-tooltip>
            </div>
        </div>
    </v-sheet>
</template>
<style lang="scss">
.ExtraBox {
    position: relative;
}

.line-height-none {
    line-height: normal;
}
</style>

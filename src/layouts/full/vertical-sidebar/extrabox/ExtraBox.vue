<template>
    <v-sheet rounded="md" color="lightprimary" class="pa-4 ExtraBox hide-menu">
        <div class="d-flex align-center justify-space-between">
            <v-tooltip :text="$t('ExtraBox.myAccount')">
                <template v-slot:activator="{ props }">
                    <router-link :to="'/account-settings'">
                        <v-avatar v-bind="props" size="50" style="cursor: pointer;">
                            <v-img :src="picture" width="50" />
                        </v-avatar>
                    </router-link>
                </template>
            </v-tooltip>
            <div>
                <h6 class="text-h6 d-flex align-center font-weight-semibold">{{ name }}</h6>
                <span class="text-subtitle-2 font-weight-medium text-grey100">
                    {{ userRole }}
                </span>
            </div>
            <div>
                <v-tooltip :text="$t('ExtraBox.logOut')">
                    <template v-slot:activator="{ props }">
                        <v-btn icon class="bg-lightprimary" flat size="small" @click="logout()" v-bind="props">
                            <Icon icon="mdi-logout-variant" class="text-primary" width="20" height="20" />
                        </v-btn>
                    </template>
                </v-tooltip>
            </div>
        </div>
    </v-sheet>
</template>

<script>
import { defineComponent } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { Icon } from '@iconify/vue';
import BackendFactory from '@/components/api/BackendFactory';
import { authClaimsState } from '@/utils/authClaims';
const backend = BackendFactory.createBackend();

export default defineComponent({
    name: 'ExtraBox',
    components: {
        Icon
    },
    data() {
        return {
            name: '',
            picture: '',
            isAdmin: false,
            authStore: useAuthStore()
        };
    },
    computed: {
        userRole() {
            return authClaimsState.isAdmin ? 'Admin' : '';
        }
    },
    async mounted() {
        this.name = localStorage.getItem('userName') || '';
        this.picture = localStorage.getItem('picture') || '';
        this.isAdmin = authClaimsState.isAdmin;
    },
    updated() {
        this.isAdmin = authClaimsState.isAdmin;
    },
    methods: {
        logout() {
            this.authStore.logout();
        }
    }
});
</script>

<style lang="scss">
.ExtraBox {
    position: relative;
}

.line-height-none {
    line-height: normal;
}
</style>

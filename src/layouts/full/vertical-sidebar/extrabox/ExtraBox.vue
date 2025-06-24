<template>
    <v-sheet rounded="md" color="lightprimary" class="pa-4  ExtraBox hide-menu">
        <div class="d-flex align-center justify-space-between">
            <v-avatar size="50">
                <v-img :src="picture" width="50" />
            </v-avatar>
            <div>
                <h6 class="text-h6 d-flex align-center font-weight-semibold">{{ name }}</h6>
                <span class="text-subtitle-2 font-weight-medium text-grey100">
                    {{ userRole }}
                </span>
            </div>
            <div>
                <v-tooltip :text="$t('ExtraBox.logOut')">
                    <template v-slot:activator="{ props }">
                        <v-btn icon class="bg-lightprimary" flat  size="small" @click="logout()" v-bind="props">
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
            return this.isAdmin ? 'Admin' : '';
        }
    },
    mounted() {
        this.name = localStorage.getItem("userName") || '';
        this.picture = localStorage.getItem("picture") || '';
        this.isAdmin = localStorage.getItem("isAdmin") === 'true';

        window.addEventListener('localStorageChange', (event) => {
            if (event.detail.key === 'isAdmin') {
                this.isAdmin = event.detail.value === 'true' || event.detail.value === true;
            }
        });
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
